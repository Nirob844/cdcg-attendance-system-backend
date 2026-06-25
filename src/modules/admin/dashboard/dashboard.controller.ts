import { Controller, Get, UseGuards, Query, Param } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles(Role.ADMIN)
  getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('employee-role-distribution')
  @Roles(Role.ADMIN)
  getEmployeeRoleDistribution() {
    return this.dashboardService.getEmployeeRoleDistribution();
  }

  @Get('attendance-report')
  @Roles(Role.ADMIN)
  getAttendanceReport(
    @Query('start') start: string, // can be month or date
    @Query('end') end?: string, // optional
    @Query('year') year?: string, // optional
    @Query('project_id') project_id?: string, // <-- add this line
  ) {
    // If only month is provided (e.g., start = '06'), use current year
    if (start && !start.includes('-') && !end) {
      const yearToUse = year || new Date().getFullYear().toString();
      // start = month (e.g., '06')
      const month = start.padStart(2, '0');
      const firstDay = `${yearToUse}-${month}-01`;
      const lastDay = new Date(Number(yearToUse), Number(month), 0); // last day of month
      const lastDayStr = `${yearToUse}-${month}-${lastDay.getDate().toString().padStart(2, '0')}`;
      return this.dashboardService.getAttendanceReport({
        start: firstDay,
        end: lastDayStr,
        project_id,
      }); // <-- pass project_id
    }
    // If both start and end are provided, use as is
    return this.dashboardService.getAttendanceReport({
      start,
      end,
      project_id,
    }); // <-- pass project_id
  }

  @Get('employee/:user_id')
  @Roles(Role.ADMIN, Role.EMPLOYEE)
  getEmployeeDashboard(
    @Param('user_id') user_id: string,
    @Query() query: { month?: string; year?: string },
  ) {
    return this.dashboardService.getEmployeeSummary(
      user_id,
      query?.month,
      query?.year,
    );
  }

  @Get('employee/:user_id/month-summary')
  @Roles(Role.ADMIN, Role.EMPLOYEE)
  async getEmployeeMonthSummary(
    @Param('user_id') user_id: string,
    @Query('month') month: string,
    @Query('year') year?: string,
  ) {
    const yearToUse = year || new Date().getFullYear().toString();
    const yearNum = Number(yearToUse) || new Date().getFullYear();
    const monthNum = Number(month);

    // Validate month and year
    if (!month || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return { success: false, message: 'Invalid or missing month parameter.' };
    }
    if (isNaN(yearNum) || yearNum < 1970) {
      return { success: false, message: 'Invalid year parameter.' };
    }

    return this.dashboardService.getEmployeeMonthAttendanceSummary(
      user_id,
      month,
      yearToUse,
    );
  }
}
