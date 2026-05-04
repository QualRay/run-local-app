import 'server-only';
import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    // 1. Initialize Firebase Admin
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }

    const { firebaseToken } = await request.json();

    // 2. Verify Firebase SMS Token
    const decodedFirebaseToken = await admin.auth().verifyIdToken(firebaseToken);
    
    // Convert 28-char Firebase string to valid 36-char Postgres UUID
    const supabaseUuid = crypto.createHash('md5').update(decodedFirebaseToken.uid).digest('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');

    // 3. Mint Supabase JWT Context
    // Matches Postgres auth.uid()
    const supabasePayload = {
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7), // 1 week
      sub: supabaseUuid,
      phone: decodedFirebaseToken.phone_number,
      role: 'authenticated',
    };

    const supabaseToken = jwt.sign(
      supabasePayload, 
      process.env.SUPABASE_JWT_SECRET!
    );

    // 4. Store safely in HTTP cookie for SSR to access securely
    const cookieStore = cookies();
    cookieStore.set('sb-custom-auth-token', supabaseToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    return NextResponse.json({ success: true, supabaseToken });

  } catch (error: any) {
    console.error("Token swap failed:", error.message);
    return NextResponse.json({ error: 'Unauthorized token conversion' }, { status: 401 });
  }
}
