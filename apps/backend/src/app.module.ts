import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CvsModule } from './cvs/cvs.module';
import { LettersModule } from './letters/letters.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [AuthModule, CvsModule, LettersModule, UsersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
