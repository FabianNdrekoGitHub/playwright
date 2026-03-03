import { Module } from '@nestjs/common';
import { FormFillerService } from './form-filler.service';

@Module({
  providers: [FormFillerService],
  exports: [FormFillerService],
})
export class FormFillerModule {}
