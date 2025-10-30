import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CvsModule } from './cvs/cvs.module';
import { LettersModule } from './letters/letters.module';

@Module({
  imports: [AuthModule, CvsModule, LettersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
