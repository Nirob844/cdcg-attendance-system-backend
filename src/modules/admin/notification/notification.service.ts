import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SojebStorage } from 'src/common/lib/Disk/SojebStorage';
import appConfig from 'src/config/app.config';
import { UserRepository } from 'src/common/repository/user/user.repository';
import { Role } from 'src/common/guard/role/role.enum';
import { LoanStatus } from '@prisma/client';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  async findAll(user_id: string) {
    try {
      const where_condition = {};
      const userDetails = await UserRepository.getUserDetails(user_id);

      if (userDetails.type == Role.ADMIN) {
        where_condition['OR'] = [
          { receiver_id: { equals: user_id } },
          { receiver_id: { equals: null } },
        ];
      }
      // else if (userDetails.type == Role.VENDOR) {
      //   where_condition['receiver_id'] = user_id;
      // }

      const notifications = await this.prisma.notification.findMany({
        where: {
          ...where_condition,
        },
        select: {
          id: true,
          sender_id: true,
          receiver_id: true,
          entity_id: true,
          created_at: true,
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          notification_event: {
            select: {
              id: true,
              type: true,
              text: true,
            },
          },
        },
      });

      // Format notifications to match socket.io payload format
      const formattedNotifications = [];
      if (notifications.length > 0) {
        for (const notification of notifications) {
          let amount = null;

          // If this is a loan notification, fetch the loan amount
          if (
            notification.entity_id &&
            notification.notification_event?.text?.includes('loan request')
          ) {
            try {
              const loan = await this.prisma.employeeLoan.findUnique({
                where: { id: notification.entity_id },
                select: { loan_amount: true },
              });
              amount = loan?.loan_amount || null;
            } catch (error) {
              console.error('Error fetching loan amount:', error);
            }
          }

          const formattedNotification = {
            receiver_id: notification.receiver_id,
            sender_id: notification.sender_id,
            sender_name: notification.sender?.name || 'Unknown',
            sender_image: notification.sender?.avatar
              ? SojebStorage.url(
                  appConfig().storageUrl.avatar + notification.sender.avatar,
                )
              : null,
            text: notification.notification_event?.text || 'Notification',
            amount: amount,
            type: notification.notification_event?.type || 'message',
            entity_id: notification.entity_id,
            id: notification.id,
            created_at: notification.created_at,
          };

          formattedNotifications.push(formattedNotification);
        }
      }

      return {
        success: true,
        data: formattedNotifications,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async update(id: string, status: string, notes?: string) {
    console.log('Updating loan status to: ', status);
    try {
      const loan = await this.prisma.employeeLoan.update({
        where: { id: id },
        data: { loan_status: status as LoanStatus, notes: notes },
      });
      return {
        success: true,
        message: 'Loan status updated successfully',
        data: loan,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async remove(id: string, user_id: string) {
    try {
      // check if notification exists
      const notification = await this.prisma.notification.findUnique({
        where: {
          id: id,
          // receiver_id: user_id,
        },
      });

      if (!notification) {
        return {
          success: false,
          message: 'Notification not found',
        };
      }

      await this.prisma.notification.delete({
        where: {
          id: id,
        },
      });

      return {
        success: true,
        message: 'Notification deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async removeAll(user_id: string) {
    try {
      // check if notification exists
      const notifications = await this.prisma.notification.findMany({
        where: {
          OR: [{ receiver_id: user_id }, { receiver_id: null }],
        },
      });

      if (notifications.length == 0) {
        return {
          success: false,
          message: 'Notification not found',
        };
      }

      await this.prisma.notification.deleteMany({
        where: {
          OR: [{ receiver_id: user_id }, { receiver_id: null }],
        },
      });

      return {
        success: true,
        message: 'All notifications deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
