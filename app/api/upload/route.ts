import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, BUCKET_NAME } from "@/lib/s3-client";

export async function POST(request: Request) {
    try {
        const { fileName, fileType, bucket, folder } = await request.json();

        if (!fileName || !fileType) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const bucketName = bucket || BUCKET_NAME;
        const filePath = folder ? `${folder}/${fileName}` : fileName;

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: filePath,
            ContentType: fileType,
        });

        // Generate pre-signed URL for client-side upload
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        
        // Construct the public URL (ensure your bucket has public read access or use CloudFront)
        const publicUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${filePath}`;

        return NextResponse.json({ uploadUrl, publicUrl });
    } catch (error) {
        console.error("S3 Presigned URL Error:", error);
        return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 });
    }
}
