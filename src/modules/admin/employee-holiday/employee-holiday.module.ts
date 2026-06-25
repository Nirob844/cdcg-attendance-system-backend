import { Module } from '@nestjs/common';
import { EmployeeHolidayService } from './employee-holiday.service';
import { EmployeeHolidayController } from './employee-holiday.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EmployeeHolidayController],
  providers: [EmployeeHolidayService],
})
export class EmployeeHolidayModule {}
