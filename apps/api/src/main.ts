import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>("PORT", 4000);

  app.enableCors({
    origin: config.get<string>("WEB_ORIGIN", "http://localhost:3000"),
    credentials: true
  });

  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("TASK Flow API")
    .setDescription("Phase 1 multi-tenant SaaS foundation API")
    .setVersion("0.1.0")
    .addBearerAuth()
    .addApiKey({ type: "apiKey", in: "header", name: "x-company-id" }, "tenant")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  await app.listen(port);
}

void bootstrap();
