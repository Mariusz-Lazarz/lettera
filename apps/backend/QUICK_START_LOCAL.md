# Quick Start: Local Development (bez AWS S3)

Jeśli chcesz testować funkcję upload CV lokalnie **bez konfiguracji AWS S3**, możesz użyć **MinIO** - lokalnej alternatywy S3.

## Opcja 1: Użyj MinIO (Lokalna alternatywa S3)

### 1. Zainstaluj i uruchom MinIO (Docker)

```bash
# Uruchom MinIO w Dockerze
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  --name minio \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  quay.io/minio/minio server /data --console-address ":9001"
```

### 2. Utwórz bucket

1. Otwórz MinIO Console: http://localhost:9001
2. Login: `minioadmin` / `minioadmin`
3. Utwórz bucket o nazwie: `lettera-cvs-local`

### 3. Skonfiguruj `.env`

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/lettera?schema=public"

# JWT
JWT_SECRET="dev-secret-key-123"
JWT_EXPIRES_IN="7d"
BCRYPT_ROUNDS="12"

# MinIO (S3-compatible) - LOCAL DEVELOPMENT
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="minioadmin"
AWS_SECRET_ACCESS_KEY="minioadmin"
AWS_S3_BUCKET_NAME="lettera-cvs-local"
AWS_ENDPOINT="http://localhost:9000"

# Server
PORT="3000"
NODE_ENV="development"
```

### 4. Zaktualizuj StorageService dla MinIO

Dodaj endpoint do konstruktora S3Client:

```typescript
// W src/storage/storage.service.ts
this.s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.AWS_ENDPOINT, // dla MinIO
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: true, // Wymagane dla MinIO
});
```

### 5. Uruchom aplikację

```bash
pnpm dev
```

### 6. Testuj upload

```bash
# Zarejestruj użytkownika
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Test1234"}'

# Zapisz token z odpowiedzi
export TOKEN="your-token-here"

# Upload CV
curl -X POST http://localhost:3000/cvs \
  -H "Authorization: Bearer $TOKEN" \
  -F "cv=@sample.pdf" \
  -F "filename=test-cv.pdf"
```

### 7. Sprawdź wynik

- MinIO Console: http://localhost:9001
- Bucket: `lettera-cvs-local`
- Folder: `user/{userId}/cvs/`

---

## Opcja 2: Użyj prawdziwego AWS S3 (Testowe)

### 1. Utwórz darmowe konto AWS
- https://aws.amazon.com/free/

### 2. Utwórz S3 bucket (AWS Console)
- Nazwa: `lettera-cvs-dev-{your-name}`
- Region: `us-east-1` (lub dowolny)
- **Block all public access**: ✅ Włączone

### 3. Utwórz IAM User
1. AWS Console → IAM → Users → Create user
2. User name: `lettera-backend-dev`
3. Access type: Programmatic access
4. Attach policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::lettera-cvs-dev-{your-name}/*"
    }
  ]
}
```
5. Zapisz **Access Key ID** i **Secret Access Key**

### 4. Skonfiguruj `.env`

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/lettera?schema=public"

# JWT
JWT_SECRET="dev-secret-key-123"
JWT_EXPIRES_IN="7d"
BCRYPT_ROUNDS="12"

# AWS S3 - REAL AWS
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
AWS_S3_BUCKET_NAME="lettera-cvs-dev-yourname"

# Server
PORT="3000"
NODE_ENV="development"
```

### 5. Uruchom i testuj

```bash
pnpm dev
```

Następnie testuj według kroków z Opcji 1.

---

## Opcja 3: Tymczasowo wyłącz upload (Mock)

Jeśli chcesz **tymczasowo** pracować bez S3:

### 1. Utwórz Mock Storage Service

```typescript
// src/storage/storage.service.mock.ts
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class StorageServiceMock {
  private readonly logger = new Logger('StorageServiceMock');

  async uploadFile(key: string, buffer: Buffer, contentType: string): Promise<void> {
    this.logger.log(`[MOCK] Uploaded file: ${key} (${buffer.length} bytes)`);
    // Symulacja - nic nie robi
  }

  async deleteFile(key: string): Promise<void> {
    this.logger.log(`[MOCK] Deleted file: ${key}`);
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    return `http://localhost:3000/mock/${key}?expires=${expiresIn}`;
  }
}
```

### 2. Użyj Mock w CvsModule (tylko dev!)

```typescript
// src/cvs/cvs.module.ts
import { StorageServiceMock } from '../storage/storage.service.mock';

@Module({
  // ...
  providers: [
    CvsService,
    {
      provide: StorageService,
      useClass: process.env.NODE_ENV === 'development' 
        ? StorageServiceMock 
        : StorageService,
    },
    PrismaService,
  ],
})
```

### 3. Usuń walidację AWS z konstruktora (tymczasowo)

W `storage.service.ts` zakomentuj `throw new Error(...)` w konstruktorze.

⚠️ **Uwaga:** To tylko dla lokalnego developmentu! Nie commituj tego do produkcji!

---

## Weryfikacja działania

Po uruchomieniu aplikacji z jedną z powyższych opcji:

```bash
# Sprawdź logi - powinno być:
[Nest] INFO [StorageService] StorageService initialized with bucket: lettera-cvs-local

# Testuj endpoint:
curl http://localhost:3000/api
# -> Swagger UI powinno działać
```

## Czyszczenie

### MinIO Docker
```bash
docker stop minio
docker rm minio
```

### AWS S3
- Usuń wszystkie pliki z bucketa
- Usuń bucket
- Usuń IAM usera

---

## FAQ

**Q: Czy mogę używać MinIO w produkcji?**
A: Tak, ale zalecamy AWS S3 dla produkcji (lepsze SLA, backup, security).

**Q: Czy MinIO jest kompatybilny z AWS S3 API?**
A: Tak, w 99% przypadków. Nasza implementacja działa z oboma.

**Q: Jak zmienić z MinIO na AWS S3?**
A: Wystarczy zmienić zmienne środowiskowe w `.env` i zrestartować.

**Q: Czy muszę mieć kartę kredytową dla AWS Free Tier?**
A: Tak, ale free tier daje 5GB storage i 20,000 requestów/miesiąc za darmo przez 12 miesięcy.

