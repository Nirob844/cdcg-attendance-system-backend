import { PartialType } from '@nestjs/mapped-types';
import { CreateEmployeeHolidayDto } from './create-employee-holiday.dto';

export class UpdateEmployeeHolidayDto extends PartialType(
  CreateEmployeeHolidayDto,
) {}
