import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { EmployeeLoanService } from './employee-loan.service';
import { CreateEmployeeLoanDto } from './dto/create-employee-loan.dto';
import { UpdateEmployeeLoanDto } from './dto/update-employee-loan.dto';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employee-loan')
export class EmployeeLoanController {
  constructor(private readonly employeeLoanService: EmployeeLoanService) {}

  // Employee: Create loan request
  @Post()
  @Roles(Role.EMPLOYEE)
  create(@Body() dto: CreateEmployeeLoanDto) {
    return this.employeeLoanService.createLoanRequest(dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  findAllLoans(
    @Query()
    query: {
      page?: string;
      limit?: string;
      search?: string;
      loan_status?: string;
    },
  ) {
    return this.employeeLoanService.findAllLoans(query);
  }

  // Employee: Get all their loans
  @Get('user/:user_id')
  @Roles(Role.ADMIN)
  findEmployeeLoans(@Param('user_id') user_id: string) {
    return this.employeeLoanService.findEmployeeLoans(user_id);
  }

  // Admin: Update loan
  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeLoanDto) {
    return this.employeeLoanService.updateLoan(id, dto);
  }

  // Admin: Delete loan
  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.employeeLoanService.deleteLoan(id);
  }
}
