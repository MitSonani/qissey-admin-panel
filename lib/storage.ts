import { supabase } from "./supabase";

export async function uploadProductImage(file: File) {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `products/${fileName}`;

    try {
        const { data, error } = await supabase.storage
            .from("product-images")
            .upload(filePath, file);

        if (error) {
            throw error;
        }

        // Return the public URL
        const { data: { publicUrl } } = supabase.storage
            .from("product-images")
            .getPublicUrl(filePath);

        return publicUrl;
    } catch (error) {
        console.error("Supabase Storage Upload Error:", error);
        throw new Error("Failed to upload image to Supabase Storage");
    }
}
