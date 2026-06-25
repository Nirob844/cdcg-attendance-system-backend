import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class UserDeletionService {
  constructor(private prisma: PrismaService) {}

  async deleteUserByEmailPassword(email: string, password: string) {
    try {
      // Find user by email
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true, password: true, email: true, name: true },
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      // Verify password
      const bcrypt = require('bcrypt');
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return {
          success: false,
          message: 'Invalid password',
        };
      }

      // Delete user
      await this.prisma.user.delete({
        where: { id: user.id },
      });

      return {
        success: true,
        message: 'Account deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
