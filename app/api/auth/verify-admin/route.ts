import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceRoleKey) {
            console.error('Missing Supabase environment variables for admin verification');
            return NextResponse.json({
                error: 'Server configuration error. Please ensure SUPABASE_SERVICE_ROLE_KEY is set.'
            }, { status: 500 });
        }

        // Use the service role key to bypass RLS
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        const { data: profile, error } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('email', email)
            .single();

        if (error || !profile || profile.role !== 'admin') {
            return NextResponse.json({ isAdmin: false, message: 'Access denied. Only admins can log in.' });
        }

        return NextResponse.json({ isAdmin: true });
    } catch (error) {
        console.error('Verify Admin Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
