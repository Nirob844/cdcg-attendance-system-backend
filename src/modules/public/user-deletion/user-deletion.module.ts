import { Module } from '@nestjs/common';
import { UserDeletionService } from './user-deletion.service';
import { UserDeletionController } from './user-deletion.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UserDeletionController],
  providers: [UserDeletionService],
})
export class UserDeletionModule {}
