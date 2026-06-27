import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { toUtc } from 'src/common/helper/timezone.helper';
import { Cron } from '@nestjs/schedule';
import { AttendanceStatus } from './dto/attendance-status.enum';
import { FileUrlHelper } from 'src/common/helper/file-url.helper';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  private parseDateOnly(value?: string | Date | null): Date | undefined {
    if (!value) return undefined;

    if (value instanceof Date) {
      return new Date(
        Date.UTC(
          value.getUTCFullYear(),
          value.getUTCMonth(),
          value.getUTCDate(),
        ),
      );
    }

    const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const year = Number(dateOnlyMatch[1]);
      const month = Number(dateOnlyMatch[2]) - 1;
      const day = Number(dateOnlyMatch[3]);
      return new Date(Date.UTC(year, month, day));
    }

    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) return undefined;

    return new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate(),
      ),
    );
  }

  private parseDateTime(value?: string | Date | null): Date | null {
    if (!value) return null;
    const parsed = value instanceof Date ? new Date(value) : new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  private formatDateOnly(value: Date): string {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private calculateTimesAndHours(
    dateInput: string | Date,
    hoursInput?: number | null,
    startTimeInput?: string | Date | null,
    endTimeInput?: string | Date | null,
    lunchStartInput?: string | Date | null,
    lunchEndInput?: string | Date | null,
    existing?: {
      start_time?: Date | null;
      end_time?: Date | null;
      lunch_start?: Date | null;
      lunch_end?: Date | null;
    } | null,
  ) {
    const targetDate = this.parseDateOnly(dateInput);

    // 1. Determine start_time
    let start_time: Date | null = null;
    if (startTimeInput !== undefined && startTimeInput !== null) {
      start_time = this.parseDateTime(startTimeInput);
    } else if (existing?.start_time) {
      start_time = existing.start_time;
    } else {
      // Default to 8:00 AM on targetDate
      start_time = new Date(targetDate);
      start_time.setUTCHours(8, 0, 0, 0);
    }

    // 2. Determine lunch times and duration
    let lunch_start: Date | null = null;
    let lunch_end: Date | null = null;

    if (lunchStartInput !== undefined && lunchStartInput !== null) {
      lunch_start = this.parseDateTime(lunchStartInput);
    } else if (existing?.lunch_start) {
      lunch_start = existing.lunch_start;
    } else if (hoursInput !== undefined && hoursInput !== null) {
      // Default lunch_start to 12:00 PM if hours are provided
      lunch_start = new Date(targetDate);
      lunch_start.setUTCHours(12, 0, 0, 0);
    }

    if (lunchEndInput !== undefined && lunchEndInput !== null) {
      lunch_end = this.parseDateTime(lunchEndInput);
    } else if (existing?.lunch_end) {
      lunch_end = existing.lunch_end;
    } else if (hoursInput !== undefined && hoursInput !== null) {
      // Default lunch_end to 1:00 PM if hours are provided
      lunch_end = new Date(targetDate);
      lunch_end.setUTCHours(13, 0, 0, 0);
    }

    const lunchDurationMs = (lunch_start && lunch_end) ? (lunch_end.getTime() - lunch_start.getTime()) : 0;

    // 3. Determine hours and end_time
    let hours = 0;
    let end_time: Date | null = null;

    if (hoursInput !== undefined && hoursInput !== null) {
      hours = hoursInput;
      if (start_time) {
        end_time = new Date(start_time.getTime() + hours * 60 * 60 * 1000 + lunchDurationMs);
      }
    } else {
      // If hours is not provided, compute from start_time and end_time
      if (endTimeInput !== undefined && endTimeInput !== null) {
        end_time = this.parseDateTime(endTimeInput);
      } else if (existing?.end_time) {
        end_time = existing.end_time;
      }

      if (start_time && end_time) {
        hours = (end_time.getTime() - start_time.getTime()) / (1000 * 60 * 60);
        if (lunch_start && lunch_end) {
          hours -= (lunch_end.getTime() - lunch_start.getTime()) / (1000 * 60 * 60);
        }
        hours = Math.max(0, hours);
      }
    }

    const regular_hours = hours > 8 ? 8 : hours;
    const extra_hours = hours > 8 ? hours - 8 : 0;

    return {
      start_time,
      lunch_start,
      lunch_end,
      end_time,
      hours,
      regular_hours,
      extra_hours,
    };
  }

  async create(dto: CreateAttendanceDto) {
    try {
      // check if project id
      if (!dto.project_id) {
        return { success: false, message: 'Project is required.' };
      }

      const project = await this.prisma.project.findUnique({
        where: { id: dto.project_id },
      });
      if (!project) {
        return { success: false, message: 'Project not found.' };
      }

      // check if user is assigned to project
      const user = await this.prisma.projectAssignee.findFirst({
        where: { projectId: dto.project_id, userId: dto.user_id },
      });

      if (!user) {
        await this.prisma.projectAssignee.create({
          data: {
            projectId: dto.project_id,
            userId: dto.user_id,
          },
        });
      }

      const status = dto.attendance_status || 'PRESENT';
      const date = this.parseDateOnly(dto.date);

      // Check for existing attendance (either PRESENT or ABSENT)
      const existing = await this.prisma.attendance.findFirst({
        where: {
          user_id: dto.user_id,
          date,
          deleted_at: null,
        },
      });

      if (status === 'PRESENT') {
        if (existing) {
          // If existing is ABSENT, update it to PRESENT
          if (existing.attendance_status === 'ABSENT') {
            const times = this.calculateTimesAndHours(
              dto.date,
              dto.hours,
              dto.start_time,
              dto.end_time,
              dto.lunch_start,
              dto.lunch_end,
              existing
            );
            const updated = await this.prisma.attendance.update({
              where: { id: existing.id },
              data: {
                attendance_status: 'PRESENT',
                project_id: dto.project_id,
                start_time: times.start_time,
                end_time: times.end_time,
                lunch_start: times.lunch_start,
                lunch_end: times.lunch_end,
                hours: times.hours,
                regular_hours: times.regular_hours,
                extra_hours: times.extra_hours,
                notes: dto.notes,
                address: dto.address,
              },
            });

            // Update project assignee total hours and cost
            await this.updateProjectAssigneeTotals(dto.project_id, dto.user_id);

            return {
              success: true,
              data: updated,
              message: 'Attendance updated from ABSENT to PRESENT.',
            };
          }
          // If already PRESENT, prevent duplicate
          return {
            success: false,
            message:
              'Attendance already marked as PRESENT for this user and date.',
          };
        }
        // No existing record, create new PRESENT
        // Only check for duplicate if status is PRESENT (or default)
        if (status === 'PRESENT') {
          const exists = await this.prisma.attendance.findFirst({
            where: {
              user_id: dto.user_id,
              date: this.parseDateOnly(dto.date),
              attendance_status: 'PRESENT',
              deleted_at: null,
            },
          });
          if (exists) {
            return {
              success: false,
              message:
                'Attendance already marked as PRESENT for this user and date.',
            };
          }
        }

        const times = this.calculateTimesAndHours(
          dto.date,
          dto.hours,
          dto.start_time,
          dto.end_time,
          dto.lunch_start,
          dto.lunch_end,
          null
        );

        const attendance = await this.prisma.attendance.create({
          data: {
            user_id: dto.user_id,
            project_id: dto.project_id,
            date: this.parseDateOnly(dto.date),
            start_time: times.start_time,
            lunch_start: times.lunch_start,
            lunch_end: times.lunch_end,
            end_time: times.end_time,
            hours: times.hours,
            regular_hours: times.regular_hours,
            extra_hours: times.extra_hours,
            attendance_status: dto.attendance_status,
            notes: dto.notes,
            address: dto.address,
          },
        });

        // Update project assignee total hours and cost
        await this.updateProjectAssigneeTotals(dto.project_id, dto.user_id);

        // After creating attendance, fill ABSENT days for this user for the month
        const dateObj = new Date(dto.date);
        const month = dateObj.getMonth() + 1; // JS months are 0-based
        const year = dateObj.getFullYear();

        return { success: true, data: attendance };
      } else {
        // If status is ABSENT and already exists, do nothing or return
        if (existing && existing.attendance_status === 'ABSENT') {
          return {
            success: false,
            message:
              'Attendance already marked as ABSENT for this user and date.',
          };
        }
        // Otherwise, create new ABSENT record
        const attendance = await this.prisma.attendance.create({
          data: {
            user_id: dto.user_id,
            project_id: null,
            date: this.parseDateOnly(dto.date),
            attendance_status: dto.attendance_status,
            hours: 0,
            regular_hours: 0,
            extra_hours: 0,
            notes: dto.notes,
            address: dto.address,
          },
        });

        console.log(
          'attendence create data ========================>>>>>>>>>>>>>>',
          attendance,
        );

        return { success: true, data: attendance };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async findGrid({
    month,
    year,
    search,
    page = '1',
    limit = '10',
  }: {
    month: string;
    year: string;
    search?: string;
    page?: string;
    limit?: string;
  }) {
    try {
      if (!month || !year || isNaN(Number(month)) || isNaN(Number(year))) {
        return {
          success: false,
          message: 'Invalid or missing month/year parameter.',
        };
      }
      const pageNumber = parseInt(page, 10) || 1;
      const pageSize = parseInt(limit, 10) || 10;
      const skip = (pageNumber - 1) * pageSize;
      // 1. Get all users (employees) matching search
      const userWhere: any = { type: 'employee', deleted_at: null };
      if (search) {
        userWhere.OR = [
          { first_name: { contains: search, mode: 'insensitive' } },
          { last_name: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }
      const total = await this.prisma.user.count({ where: userWhere });
      const users = await this.prisma.user.findMany({
        where: userWhere,
        orderBy: { first_name: 'asc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          first_name: true,
          last_name: true,
          name: true,
          email: true,
          avatar: true,
        },
      });
      // 2. Get all attendance for these users in the given month/year
      const startDate = new Date(
        Date.UTC(Number(year), Number(month) - 1, 1, 0, 0, 0, 0),
      );
      const endDate = new Date(
        Date.UTC(Number(year), Number(month), 0, 23, 59, 59, 999),
      );
      const attendanceRecords = await this.prisma.attendance.findMany({
        where: {
          user_id: { in: users.map((u) => u.id) },
          date: { gte: startDate, lte: endDate },
          deleted_at: null,
        },
        select: {
          id: true,
          user_id: true,
          project_id: true,
          date: true,
          hours: true,
          regular_hours: true,
          extra_hours: true,
          attendance_status: true,
        },
      });
      // 3. Build grid: for each user, map days of month to { id, hours } or null
      const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
      const grid = users.map((user) => {
        const days: {
          [key: string]: {
            id: string;
            hours: number;
            regular_hours: number;
            extra_hours: number;
            attendance_status: AttendanceStatus;
            project_id: string;
          } | null;
        } = {};
        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${year}-${month.padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
          days[dateStr] = null;
        }
        attendanceRecords
          .filter((a) => a.user_id === user.id)
          .forEach((a) => {
            const dateObj = new Date(a.date);
            // Only include if the date is in the current month and year
            if (
              dateObj.getUTCFullYear() === Number(year) &&
              dateObj.getUTCMonth() === Number(month) - 1
            ) {
              const dateStr = this.formatDateOnly(dateObj);
              days[dateStr] = {
                id: a.id,
                hours: Number(a.hours),
                regular_hours: Number(a.regular_hours || 0),
                extra_hours: Number(a.extra_hours || 0),
                attendance_status: a.attendance_status as AttendanceStatus,
                project_id: a.project_id,
              };
            }
          });
        const userWithAvatar = FileUrlHelper.addAvatarUrl(user);
        return { user: userWithAvatar, days };
      });
      return {
        success: true,
        meta: {
          total,
          page: pageNumber,
          limit: pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
        data: grid,
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async getEmployeeAttendance({
    user_id,
    month,
    year,
  }: {
    user_id: string;
    month: string;
    year: string;
  }) {
    try {
      if (
        !user_id ||
        !month ||
        !year ||
        isNaN(Number(month)) ||
        isNaN(Number(year))
      ) {
        return {
          success: false,
          message: 'Invalid or missing user_id/month/year parameter.',
        };
      }
      const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
      const startDate = new Date(
        Date.UTC(Number(year), Number(month) - 1, 1, 0, 0, 0, 0),
      );
      const endDate = new Date(
        Date.UTC(Number(year), Number(month), 0, 23, 59, 59, 999),
      );
      // Get user hourly rate
      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
        select: { hourly_rate: true },
      });
      const hourlyRate = user?.hourly_rate ? Number(user.hourly_rate) : 0;
      // Get all attendance records for this user in the month
      const records = await this.prisma.attendance.findMany({
        where: {
          user_id,
          date: { gte: startDate, lte: endDate },
          deleted_at: null,
        },
        select: {
          id: true,
          date: true,
          start_time: true,
          lunch_start: true,
          lunch_end: true,
          end_time: true,
          hours: true,
          regular_hours: true,
          extra_hours: true,
        },
      });
      // Map date string (YYYY-MM-DD) to record
      const recordMap: { [date: string]: any } = {};
      records.forEach((r) => {
        const dateStr = this.formatDateOnly(r.date);
        recordMap[dateStr] = r;
      });
      // Build result for each day
      const result = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${month.padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
        const rec = recordMap[dateStr];
        const hours = rec?.hours ? Number(rec.hours) : 0;
        const regular_hours = rec?.regular_hours ? Number(rec.regular_hours) : 0;
        const extra_hours = rec?.extra_hours ? Number(rec.extra_hours) : 0;
        const earning = hours * hourlyRate;
        result.push({
          id: rec?.id || null,
          date: dateStr, // <-- always output as YYYY-MM-DD
          start_time: rec?.start_time
            ? rec.start_time.toISOString().slice(11, 16)
            : '----',
          lunch:
            rec?.lunch_start && rec?.lunch_end
              ? `${rec.lunch_start.toISOString().slice(11, 13)}-${rec.lunch_end.toISOString().slice(11, 13)}`
              : '----',
          end_time: rec?.end_time
            ? rec.end_time.toISOString().slice(11, 16)
            : '----',
          recorded_hours: regular_hours,
          extra_hours: extra_hours,
          total: rec?.hours ? `${hours.toFixed(1)} hrs` : 'No Record',
          earning: hours ? `${earning.toFixed(2)}` : '0.00',
        });
      }
      return { success: true, data: result };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async findAll(query: any) {
    try {
      const {
        user_id,
        date,
        attendance_status,
        search,
        page = '1',
        limit = '10',
      } = query;
      const pageNumber = parseInt(page, 10) || 1;
      const pageSize = parseInt(limit, 10) || 10;
      const skip = (pageNumber - 1) * pageSize;
      const where: any = { deleted_at: null };
      if (user_id) where.user_id = user_id;
      if (attendance_status) where.attendance_status = attendance_status;
      if (date) {
        where.date = this.parseDateOnly(date);
      }
      if (search) {
        where.OR = [{ notes: { contains: search, mode: 'insensitive' } }];
      }
      const total = await this.prisma.attendance.count({ where });
      const data = await this.prisma.attendance.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              employee_role: true,
            },
          },
        },
      });
      return {
        success: true,
        meta: {
          total,
          page: pageNumber,
          limit: pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
        data,
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async findOne(id: string) {
    try {
      const data = await this.prisma.attendance.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              employee_role: true,
            },
          },
        },
      });
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async update(id: string, dto: UpdateAttendanceDto) {
    try {
      // Get the existing attendance record to get project_id and user_id
      const existingAttendance = await this.prisma.attendance.findUnique({
        where: { id },
        select: {
          project_id: true,
          user_id: true,
          date: true,
          start_time: true,
          lunch_start: true,
          lunch_end: true,
          end_time: true,
          hours: true,
        },
      });

      // If attendance record doesn't exist, create a new one
      if (!existingAttendance) {
        // Validate required fields for creation
        if (!dto.user_id || !dto.project_id || !dto.date) {
          return {
            success: false,
            message:
              'user_id, project_id, and date are required to create new attendance record',
          };
        }

        // Check if user is assigned to project
        const user = await this.prisma.projectAssignee.findFirst({
          where: { projectId: dto.project_id, userId: dto.user_id },
        });

        if (!user) {
          return { success: false, message: 'User not assigned to project.' };
        }

        // Check for duplicate attendance on the same date
        const existingRecord = await this.prisma.attendance.findFirst({
          where: {
            user_id: dto.user_id,
            date: this.parseDateOnly(dto.date),
            deleted_at: null,
          },
        });

        if (existingRecord) {
          return {
            success: false,
            message: 'Attendance record already exists for this user and date.',
          };
        }

        const times = this.calculateTimesAndHours(
          dto.date,
          dto.hours,
          dto.start_time,
          dto.end_time,
          dto.lunch_start,
          dto.lunch_end,
          null
        );

        const attendance_status = times.hours > 0 ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT;
        const isPresent = attendance_status === AttendanceStatus.PRESENT;

        let project_id = dto.project_id;
        if (!isPresent) {
          times.start_time = null;
          times.lunch_start = null;
          times.lunch_end = null;
          times.end_time = null;
          times.hours = 0;
          times.regular_hours = 0;
          times.extra_hours = 0;
          project_id = null;
        }

        const data = await this.prisma.attendance.create({
          data: {
            user_id: dto.user_id,
            project_id,
            date: this.parseDateOnly(dto.date),
            start_time: times.start_time,
            lunch_start: times.lunch_start,
            lunch_end: times.lunch_end,
            end_time: times.end_time,
            hours: times.hours,
            regular_hours: times.regular_hours,
            extra_hours: times.extra_hours,
            attendance_status,
            notes: dto.notes,
            address: dto.address,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                employee_role: true,
              },
            },
          },
        });

        // Update project assignee total hours and cost
        if (project_id) {
          await this.updateProjectAssigneeTotals(project_id, dto.user_id);
        }

        return {
          success: true,
          data,
          message: 'New attendance record created',
        };
      }
      // If record exists, proceed with update
      // check if user is assigned to project
      const user = await this.prisma.projectAssignee.findFirst({
        where: {
          projectId: dto.project_id,
          userId: existingAttendance.user_id,
        },
      });

      if (!user) {
        return { success: false, message: 'User not assigned to project.' };
      }

      const targetDate = dto.date ? this.parseDateOnly(dto.date) : existingAttendance.date;

      const times = this.calculateTimesAndHours(
        targetDate,
        dto.hours,
        dto.start_time,
        dto.end_time,
        dto.lunch_start,
        dto.lunch_end,
        existingAttendance
      );

      const attendance_status = times.hours > 0 ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT;
      const isPresent = attendance_status === AttendanceStatus.PRESENT;

      let project_id = dto.project_id;
      if (!isPresent) {
        times.start_time = null;
        times.lunch_start = null;
        times.lunch_end = null;
        times.end_time = null;
        times.hours = 0;
        times.regular_hours = 0;
        times.extra_hours = 0;
        project_id = null;
      }

      const data = await this.prisma.attendance.update({
        where: { id },
        data: {
          ...dto,
          date: this.parseDateOnly(dto.date),
          project_id,
          start_time: times.start_time,
          lunch_start: times.lunch_start,
          lunch_end: times.lunch_end,
          end_time: times.end_time,
          hours: times.hours,
          regular_hours: times.regular_hours,
          extra_hours: times.extra_hours,
          attendance_status,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              employee_role: true,
            },
          },
        },
      });

      // Check if project_id changed
      const oldProjectId = existingAttendance.project_id;
      const newProjectId = project_id;

      if (newProjectId !== oldProjectId) {
        if (oldProjectId) {
          await this.updateProjectAssigneeTotals(
            oldProjectId,
            existingAttendance.user_id,
          );
        }
        if (newProjectId) {
          await this.updateProjectAssigneeTotals(
            newProjectId,
            existingAttendance.user_id,
          );
        }
      } else {
        // Project didn't change
        if (newProjectId) {
          await this.updateProjectAssigneeTotals(
            newProjectId,
            existingAttendance.user_id,
          );
        }
      }

      return { success: true, data, message: 'Attendance record updated' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async remove(id: string) {
    try {
      // Get the attendance record before deleting to get project_id and user_id
      const attendance = await this.prisma.attendance.findUnique({
        where: { id },
        select: { project_id: true, user_id: true },
      });

      if (!attendance) {
        return { success: false, message: 'Attendance record not found' };
      }

      const data = await this.prisma.attendance.delete({ where: { id } });

      // Update project assignee total hours and cost after deletion
      await this.updateProjectAssigneeTotals(
        attendance.project_id,
        attendance.user_id,
      );

      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async fillAbsentDaysForMonth(month: number, year: number) {
    // Get all employees
    const employees = await this.prisma.user.findMany({
      where: { type: 'employee', deleted_at: null },
      select: { id: true },
    });

    const daysInMonth = new Date(year, month, 0).getDate();

    for (const emp of employees) {
      // Get all attendance dates for this employee in the month
      const records = await this.prisma.attendance.findMany({
        where: {
          user_id: emp.id,
          date: {
            gte: new Date(year, month - 1, 1),
            lte: new Date(year, month - 1, daysInMonth),
          },
          deleted_at: null,
        },
        select: { date: true },
      });
      const attendedDays = new Set(
        records.map((r) => this.formatDateOnly(r.date)),
      );

      // For each day in the month, if not attended, create ABSENT
      for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, month - 1, d);
        const dateStr = this.formatDateOnly(dateObj);
        if (!attendedDays.has(dateStr)) {
          await this.prisma.attendance.create({
            data: {
              user_id: emp.id,
              date: dateObj,
              attendance_status: 'ABSENT',
              hours: 0,
            },
          });
        }
      }
    }
    return { success: true, message: 'Absent days filled for all employees.' };
  }

  async fillAbsentDaysForUserMonth(
    user_id: string,
    month: number,
    year: number,
    project_id: string,
  ) {
    const daysInMonth = new Date(year, month, 0).getDate();

    // 1. Get all OFF_DAY and HOLIDAY dates from academic calendar
    const calendarEvents = await this.prisma.academicCalendar.findMany({
      where: {
        deleted_at: null,
        start_date: {
          gte: new Date(year, month - 1, 1),
          lte: new Date(year, month - 1, daysInMonth),
        },
        event_type: { in: ['OFF_DAY', 'HOLIDAY', 'EXAM_DAY', 'SEMINAR'] },
      },
      select: { start_date: true },
    });
    const skipDates = new Set(
      calendarEvents.map((ev) => this.formatDateOnly(ev.start_date)),
    );

    // 2. Get all attendance dates for this user in the month
    const records = await this.prisma.attendance.findMany({
      where: {
        user_id,
        date: {
          gte: new Date(year, month - 1, 1),
          lte: new Date(year, month - 1, daysInMonth),
        },
        deleted_at: null,
      },
      select: { date: true },
    });
    const attendedDays = new Set(
      records.map((r) => this.formatDateOnly(r.date)),
    );

    // 3. For each day, skip if Sunday or in skipDates, else create ABSENT if missing
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(Date.UTC(year, month - 1, d));
      const dateStr = this.formatDateOnly(dateObj);

      // Skip if Sunday or in academic calendar OFF_DAY/HOLIDAY
      if (dateObj.getDay() === 0 || skipDates.has(dateStr)) continue;

      if (!attendedDays.has(dateStr)) {
        await this.prisma.attendance.create({
          data: {
            user_id,
            date: dateObj,
            attendance_status: 'ABSENT',
            hours: 0,
          },
        });
      }
    }
    return { success: true };
  }

  /**
   * Checks attendance for all employees for a given date.
   * If an employee has no attendance record, marks them as ABSENT.
   * @param dateStr - Date string in YYYY-MM-DD format
   */
  async checkAndFillDailyAbsence(dateStr: string) {
    const date = this.parseDateOnly(dateStr);
    if (!date) {
      return {
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD.',
      };
    }
    // 1. Get all active employees
    const employees = await this.prisma.user.findMany({
      where: { type: 'employee', deleted_at: null },
      select: { id: true },
    });
    // 2. Get all attendance records for this date
    const attendanceRecords = await this.prisma.attendance.findMany({
      where: {
        date,
        deleted_at: null,
      },
      select: { user_id: true },
    });
    const attendedUserIds = new Set(attendanceRecords.map((r) => r.user_id));
    // 3. For each employee, if no attendance, create ABSENT
    for (const emp of employees) {
      if (!attendedUserIds.has(emp.id)) {
        await this.prisma.attendance.create({
          data: {
            user_id: emp.id,
            date,
            attendance_status: 'ABSENT',
            hours: 0,
          },
        });
      }
    }
    return {
      success: true,
      message: 'All absences filled for date: ' + dateStr,
    };
  }

  //?@Cron('0 17 * * *') // 5pm
  @Cron('0 10 * * *') // 10 am
  async autoFillDailyAbsence() {
    const today = new Date();
    const dateStr = this.formatDateOnly(today);
    await this.checkAndFillDailyAbsence(dateStr);
    // Optionally log or handle result
  }

  /**
   * Updates the total_hours and total_cost for a project assignee
   * @param projectId - The project ID
   * @param userId - The user ID
   */
  private async updateProjectAssigneeTotals(projectId: string, userId: string) {
    try {
      // Get user's hourly rate
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { hourly_rate: true },
      });

      const hourlyRate = user?.hourly_rate ? Number(user.hourly_rate) : 0;

      // Calculate total hours for this user in this project
      const attendanceAgg = await this.prisma.attendance.aggregate({
        where: {
          user_id: userId,
          project_id: projectId,
          deleted_at: null,
        },
        _sum: { hours: true },
      });

      const totalHours = Number(attendanceAgg._sum.hours) || 0;
      const totalCost = totalHours * hourlyRate;

      // Update the project assignee record
      await this.prisma.projectAssignee.updateMany({
        where: {
          projectId,
          userId,
        },
        data: {
          total_hours: totalHours,
          total_cost: totalCost,
        },
      });
    } catch (error) {
      console.error('Error updating project assignee totals:', error);
      // Don't throw error to avoid breaking attendance creation
    }
  }
}
