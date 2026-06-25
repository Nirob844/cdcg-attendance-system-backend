import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoanStatus } from '@prisma/client';
import { FileUrlHelper } from 'src/common/helper/file-url.helper';
import { NotificationRepository } from 'src/common/repository/notification/notification.repository';
import { MessageGateway } from 'src/modules/chat/message/message.gateway';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';

@Injectable()
export class EmployeeLoanService {
  private readonly logger = new Logger(EmployeeLoanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messageGateway: MessageGateway,
  ) {}

  async createLoanRequest(dto: {
    user_id: string;
    loan_amount: number;
    loan_purpose?: string;
    notes?: string;
  }) {
    try {
      // Get employee info for notification
      const employee = await this.prisma.user.findUnique({
        where: { id: dto.user_id },
        select: { name: true, email: true, avatar: true },
      });

      if (!employee) {
        return { success: false, message: 'Employee not found' };
      }

      const loan = await this.prisma.employeeLoan.create({
        data: {
          user_id: dto.user_id,
          loan_amount: dto.loan_amount,
          loan_purpose: dto.loan_purpose,
          notes: dto.notes,
          loan_status: 'PENDING',
        },
      });

      // Get all admin users
      const adminUsers = await this.prisma.user.findMany({
        where: {
          type: 'admin',
          deleted_at: null,
          status: 1,
        },
        select: { id: true, name: true, email: true },
      });

      // Send notifications to all admin users
      for (const admin of adminUsers) {
        try {
          // Create in-app notification
          await NotificationRepository.createNotification({
            receiver_id: admin.id,
            sender_id: dto.user_id,
            text: `New loan request received from ${employee?.name || 'Employee'}`,
            type: 'message',
            entity_id: loan.id,
          });

          // Emit realtime notification via websocket to specific admin
          const adminSocketId = this.messageGateway.clients.get(admin.id);
          if (adminSocketId) {
            this.messageGateway.server.to(adminSocketId).emit('notification', {
              receiver_id: admin.id,
              sender_id: dto.user_id,
              sender_name: employee?.name || 'Employee',
              sender_image: employee?.avatar
                ? SojebStorage.url(
                    appConfig().storageUrl.avatar + employee.avatar,
                  )
                : null,
              text: `New loan request from ${employee?.name || 'Employee'}`,
              amount: dto.loan_amount,
              type: 'message',
              entity_id: loan.id,
            });
          }

          this.logger.log(`Sent notification to admin: ${admin.name}`);
        } catch (notificationError) {
          this.logger.error(
            `Failed to send notification to admin ${admin.id}:`,
            notificationError,
          );
        }
      }

      this.logger.log(
        `Loan request created and notifications sent to ${adminUsers.length} admin(s)`,
      );
      return { success: true, data: loan };
    } catch (error) {
      this.logger.error('Error creating loan request:', error);
      return { success: false, message: error.message };
    }
  }

  async updateLoan(
    id: string,
    dto: {
      loan_amount?: number;
      loan_purpose?: string;
      notes?: string;
      loan_status?: string;
    },
  ) {
    try {
      const updateData: any = { ...dto };
      if (dto.loan_status) {
        updateData.loan_status = dto.loan_status as LoanStatus;
      }
      const loan = await this.prisma.employeeLoan.update({
        where: { id },
        data: updateData,
      });
      return { success: true, data: loan };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async deleteLoan(id: string) {
    try {
      const loan = await this.prisma.employeeLoan.delete({ where: { id } });
      return { success: true, data: loan };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async findAllLoans(query: {
    page?: string;
    limit?: string;
    search?: string;
    loan_status?: string;
  }) {
    try {
      const { search, loan_status, page = '1', limit = '10' } = query;

      const pageNumber = parseInt(page, 10) || 1;
      const pageSize = parseInt(limit, 10) || 10;
      const skip = (pageNumber - 1) * pageSize;

      // Build dynamic where clause
      const where: any = { deleted_at: null };

      if (loan_status) {
        where.loan_status = loan_status;
      }

      if (search) {
        where.OR = [
          { loan_purpose: { contains: search, mode: 'insensitive' } },
          { notes: { contains: search, mode: 'insensitive' } },
          { user: { name: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
        ];
      }

      // Get total count for pagination
      const total = await this.prisma.employeeLoan.count({ where });

      // Get paginated data
      const loans = await this.prisma.employeeLoan.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          user_id: true,
          loan_amount: true,
          loan_purpose: true,
          loan_status: true,
          notes: true,
          created_at: true,
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      });

      const loansWithAvatar = loans.map((loan) => ({
        ...loan,
        user: loan.user ? FileUrlHelper.addAvatarUrl(loan.user) : null,
      }));

      return {
        success: true,
        meta: {
          total,
          page: pageNumber,
          limit: pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
        data: loansWithAvatar,
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async findEmployeeLoans(user_id: string) {
    try {
      const loans = await this.prisma.employeeLoan.findMany({
        where: { user_id, deleted_at: null },
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          loan_amount: true,
          loan_purpose: true,
          loan_status: true,
          notes: true,
          created_at: true,
        },
      });
      return { success: true, data: loans };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}
