import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { FormFillerService } from './form-filler/form-filler.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error'],
  });
  const formFiller = app.get(FormFillerService);
  await formFiller.run();
  await app.close();
  process.exit(0);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
