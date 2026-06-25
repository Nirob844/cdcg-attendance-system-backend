import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DateHelper } from 'src/common/helper/date.helper';
import { toZonedTime } from 'date-fns-tz';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    // Total Employees
    const totalEmployee = await this.prisma.user.count({
      where: { type: 'employee', deleted_at: null },
    });

    // Total Hours (sum of all attendance hours)
    const totalHoursAgg = await this.prisma.attendance.aggregate({
      where: { deleted_at: null },
      _sum: { hours: true },
    });
    const totalHours = Number(totalHoursAgg._sum.hours) || 0;

    // Labor Cost (derive from attendance hours x employee hourly rate)
    const laborCostRows = await this.prisma.attendance.findMany({
      where: {
        deleted_at: null,
        user: { type: 'employee', deleted_at: null },
      },
      select: {
        hours: true,
        user: {
          select: {
            hourly_rate: true,
          },
        },
      },
    });
    const laborCost = laborCostRows.reduce((sum, row) => {
      const hours = Number(row.hours) || 0;
      const rate = Number(row.user?.hourly_rate) || 0;
      return sum + hours * rate;
    }, 0);

    // Active Projects
    const activeProject = await this.prisma.project.count({
      where: { status: 1, deleted_at: null },
    });

    return {
      success: true,
      data: {
        totalEmployee,
        totalHours,
        laborCost,
        activeProject,
      },
    };
  }

  async getEmployeeRoleDistribution() {
    // Get total employees
    const total = await this.prisma.user.count({
      where: { type: 'employee', deleted_at: null },
    });

    // Group by employee_role and count
    const roles = await this.prisma.user.groupBy({
      by: ['employee_role'],
      where: { type: 'employee', deleted_at: null },
      _count: { _all: true },
    });

    // Calculate percentage for each role
    const data = roles.map((r) => ({
      role: r.employee_role,
      count: r._count._all,
      percent: total ? Math.round((r._count._all / total) * 100) : 0,
    }));

    return {
      success: true,
      data: {
        total,
        roles: data,
      },
    };
  }

  async getAttendanceReport({
    start,
    end,
    project_id,
  }: {
    start: string;
    end: string;
    project_id?: string;
  }) {
    // Validate dates
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (
      !start ||
      !end ||
      isNaN(startDate.getTime()) ||
      isNaN(endDate.getTime())
    ) {
      return { success: false, message: 'Invalid or missing start/end date.' };
    }
    // Get all attendance records in the date range
    const where: any = {
      date: { gte: startDate, lte: endDate },
      deleted_at: null,
    };
    if (project_id) {
      where.project_id = project_id;
    }
    const records = await this.prisma.attendance.findMany({
      where,
      select: {
        date: true,
        attendance_status: true,
        user_id: true,
      },
    });
    // Group by date and status
    const report: { [date: string]: { [status: string]: Set<string> } } = {};
    records.forEach((r) => {
      const dateStr = r.date.toISOString().slice(0, 10);
      if (!report[dateStr])
        report[dateStr] = { PRESENT: new Set(), ABSENT: new Set() };
      report[dateStr][r.attendance_status]?.add(r.user_id);
    });

    // Format for chart
    const dates = [];
    const present = [];
    const absent = [];
    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const dateStr = d.toISOString().slice(0, 10);
      dates.push(dateStr);
      present.push(report[dateStr]?.PRESENT?.size || 0);
      absent.push(report[dateStr]?.ABSENT?.size || 0);
    }

    return {
      success: true,
      data: {
        dates,
        present,
        absent,
      },
    };
  }

  async getEmployeeSummary(user_id: string, month?: string, year?: string) {
    // Get employee basic info
    const emp = await this.prisma.user.findUnique({
      where: { id: user_id, deleted_at: null },
      select: {
        id: true,
        name: true,
        employee_role: true,
        hourly_rate: true,
      },
    });
    if (!emp) return { success: false, message: 'Employee not found' };

    // Determine month/year window (default to current if not provided)
    const now = new Date();
    const monthNum =
      month && !isNaN(Number(month)) ? Number(month) : now.getMonth() + 1;
    const yearNum =
      year && !isNaN(Number(year)) ? Number(year) : now.getFullYear();
    // Use UTC to avoid timezone issues and ensure month boundaries are correct
    const startDate = new Date(Date.UTC(yearNum, monthNum - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(yearNum, monthNum, 0, 23, 59, 59, 999));
    const dateFilter: any = { gte: startDate, lte: endDate };

    // Calculate total hours in window
    const agg = await this.prisma.attendance.aggregate({
      where: {
        user_id,
        deleted_at: null,
        date: dateFilter,
      },
      _sum: { hours: true },
    });
    const totalHours = Number(agg._sum.hours) || 0;
    const perHour = Number(emp.hourly_rate) || 0;
    const earning = totalHours * perHour;

    // Calculate total working days (unique days with attendance)
    const workingDays = (
      await this.prisma.attendance.findMany({
        where: {
          user_id,
          deleted_at: null,
          attendance_status: 'PRESENT',
          date: { gte: startDate, lte: endDate },
        },
        distinct: ['date'],
        select: { date: true },
      })
    ).length;

    return {
      success: true,
      data: {
        name: emp.name,
        role: emp.employee_role,
        totalHours,
        perHour,
        earning,
        days: workingDays,
      },
    };
  }

  async getEmployeeMonthAttendanceSummary(
    user_id: string,
    month: string,
    year?: string,
  ) {
    const yearNum = Number(year) || new Date().getFullYear();
    const monthNum = Number(month);
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const timeZone = 'Europe/Lisbon';

    // Get all OFF_DAY and HOLIDAY dates from academic calendar
    const calendarEvents = await this.prisma.academicCalendar.findMany({
      where: {
        deleted_at: null,
        start_date: {
          gte: new Date(yearNum, monthNum - 1, 1),
          lte: new Date(yearNum, monthNum - 1, daysInMonth),
        },
        event_type: { in: ['OFF_DAY', 'HOLIDAY', 'EXAM_DAY', 'SEMINAR'] },
      },
      select: { start_date: true },
    });
    const skipDates = new Set(
      calendarEvents.map((ev) =>
        toZonedTime(ev.start_date, timeZone).toISOString().slice(0, 10),
      ),
    );

    // Get all attendance for this user in the month
    const records = await this.prisma.attendance.findMany({
      where: {
        user_id,
        date: {
          gte: new Date(yearNum, monthNum - 1, 1),
          lte: new Date(yearNum, monthNum - 1, daysInMonth),
        },
        deleted_at: null,
      },
      select: { date: true, attendance_status: true },
    });

    // Filter out dates from previous/next months
    const currentMonthRecords = records.filter((record) => {
      const recordDate = new Date(record.date);
      return (
        recordDate.getMonth() === monthNum - 1 &&
        recordDate.getFullYear() === yearNum
      );
    });
    const recordMap = new Map(
      currentMonthRecords.map((r) => [
        r.date.toISOString().slice(0, 10),
        r.attendance_status,
      ]),
    );

    // Build day list and count
    let complete = 0,
      unfinished = 0,
      totalWorkingDays = 0;
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const utcDate = new Date(Date.UTC(yearNum, monthNum - 1, d));
      const dateObj = toZonedTime(utcDate, timeZone);
      const dateStr = dateObj.toISOString().slice(0, 10);

      // Ensure we only include dates from the current month
      const dateParts = dateStr.split('-');
      const currentYear = parseInt(dateParts[0]);
      const currentMonth = parseInt(dateParts[1]);

      if (currentYear !== yearNum || currentMonth !== monthNum) continue;

      // Skip if Sunday or in academic calendar OFF_DAY/HOLIDAY
      if (dateObj.getDay() === 0 || skipDates.has(dateStr)) continue;

      totalWorkingDays++;
      const status = recordMap.get(dateStr) || 'Unfinished';
      if (status === 'PRESENT') complete++;
      else unfinished++;

      days.push({ date: dateStr, status });
    }

    const percentComplete = totalWorkingDays
      ? Math.round((complete / totalWorkingDays) * 100)
      : 0;
    const percentUnfinished = 100 - percentComplete;

    return {
      success: true,
      data: {
        complete,
        unfinished,
        percentComplete,
        percentUnfinished,
        totalWorkingDays,
        days, // for calendar view
      },
    };
  }
}
