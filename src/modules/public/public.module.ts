import { Module } from '@nestjs/common';
import { UserDeletionModule } from './user-deletion/user-deletion.module';

@Module({
  imports: [UserDeletionModule],
})
export class PublicModule {}
