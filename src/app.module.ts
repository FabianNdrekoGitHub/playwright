import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import formFillerConfig from './config/form-filler.config';
import { FormFillerModule } from './form-filler/form-filler.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [formFillerConfig] }),
    FormFillerModule,
  ],
})
export class AppModule {}
