import { Module } from '@nestjs/common';
import { EmployeeLoanService } from './employee-loan.service';
import { EmployeeLoanController } from './employee-loan.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EmployeeLoanController],
  providers: [EmployeeLoanService],
})
export class EmployeeLoanModule {}
