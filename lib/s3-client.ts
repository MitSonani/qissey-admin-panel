import { S3Client } from "@aws-sdk/client-s3";

// Standard AWS environment variables (Server-side only)
const region = process.env.AWS_REGION || "us-east-1";
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

if (!accessKeyId || !secretAccessKey) {
    if (typeof window === 'undefined') {
        console.warn("AWS credentials are missing. S3 uploads will fail.");
    }
}

export const s3Client = new S3Client({
    region,
    credentials: {
        accessKeyId: accessKeyId || "",
        secretAccessKey: secretAccessKey || "",
    },
});

export const BUCKET_NAME = process.env.AWS_BUCKET_NAME || "";
