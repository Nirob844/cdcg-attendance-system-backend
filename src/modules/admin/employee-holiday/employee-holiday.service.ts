import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateEmployeeHolidayDto } from './dto/create-employee-holiday.dto';
import { UpdateEmployeeHolidayDto } from './dto/update-employee-holiday.dto';
import { EmployeeHolidayQueryDto } from './dto/employee-holiday-query.dto';
import { FileUrlHelper } from 'src/common/helper/file-url.helper';

@Injectable()
export class EmployeeHolidayService {
  constructor(private readonly prisma: PrismaService) { }

  async create(dto: CreateEmployeeHolidayDto) {
    try {
      const data = await this.prisma.employeeHoliday.create({
        data: {
          user_id: dto.user_id,
          start_date: new Date(dto.start_date),
          end_date: new Date(dto.end_date),
        },
      });
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async findAll(query: EmployeeHolidayQueryDto) {
    try {
      const {
        user_id,
        start_date,
        end_date,
        page = '1',
        limit = '10',
      } = query;

      const pageNumber = parseInt(page, 10) || 1;
      const pageSize = parseInt(limit, 10) || 10;
      const skip = (pageNumber - 1) * pageSize;

      const where: any = {};
      if (user_id) where.user_id = user_id;
      if (start_date) where.start_date = { gte: new Date(start_date) };
      if (end_date) where.end_date = { lte: new Date(end_date) };

      const total = await this.prisma.employeeHoliday.count({ where });

      const data = await this.prisma.employeeHoliday.findMany({
        where,
        orderBy: { start_date: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          user_id: true,
          start_date: true,
          end_date: true,
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              name: true,
              email: true,
              avatar: true,
              employee_role: true,
            },
          },
        },
      });

      const dataWithTotalDays = data.map(item => ({
        ...item,
        total_days: Math.ceil(
          (new Date(item.end_date).getTime() - new Date(item.start_date).getTime()) / (1000 * 60 * 60 * 24) + 1
        ),
        user: FileUrlHelper.addAvatarUrl(item.user),
      }));

      return {
        success: true,
        meta: {
          total,
          page: pageNumber,
          limit: pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
        data: dataWithTotalDays,
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async findEmployeeHolidays(user_id: string) {
    try {
      const data = await this.prisma.employeeHoliday.findMany({
        where: { user_id },
        orderBy: { start_date: 'desc' },
        select: {
          id: true,
          user_id: true,
          start_date: true,
          end_date: true,
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              name: true,
              email: true,
              avatar: true,
              employee_role: true,
            },
          },
        },
      });

      const dataWithTotalDays = data.map(item => ({
        ...item,
        total_days: Math.ceil(
          (new Date(item.end_date).getTime() - new Date(item.start_date).getTime()) / (1000 * 60 * 60 * 24) + 1
        ),
        user: FileUrlHelper.addAvatarUrl(item.user),
      }));

      return { success: true, data: dataWithTotalDays };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async findOne(id: string) {
    try {
      const data = await this.prisma.employeeHoliday.findUnique({
        where: { id },
        select: {
          id: true,
          user_id: true,
          start_date: true,
          end_date: true,
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              name: true,
              email: true,
              avatar: true,
              employee_role: true,
            },
          },
        },
      });
      if (data) {
        Object.assign(data, {
          total_days: Math.ceil(
            (new Date(data.end_date).getTime() - new Date(data.start_date).getTime()) / (1000 * 60 * 60 * 24) + 1
          ),
          user: FileUrlHelper.addAvatarUrl(data.user),
        });
      }
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async update(id: string, dto: UpdateEmployeeHolidayDto) {
    try {
      const data = await this.prisma.employeeHoliday.update({
        where: { id },
        data: {
          ...dto,
          start_date: dto.start_date ? new Date(dto.start_date) : undefined,
          end_date: dto.end_date ? new Date(dto.end_date) : undefined,
        },
      });
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async remove(id: string) {
    try {
      const data = await this.prisma.employeeHoliday.delete({
        where: { id },
      });
      return { success: true, data };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}
