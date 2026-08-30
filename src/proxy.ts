import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

/**
 * Yengil marshrut himoyasi (Next.js proxy — avvalgi "middleware").
 * Bu yerda faqat cookie mavjudligini tekshiramiz — asl authorization
 * har bir sahifa/action ichida server tomonda (requireUser/requireRole) bajariladi.
 */
export function proxy(req: NextRequest) {
  const hasSession = req.cookies.has(SESSION_COOKIE);

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Quyidagilardan tashqari barcha sahifa marshrutlarini himoyalaymiz:
  //  - /login (kirish sahifasi)
  //  - /api/* (o'z auth mexanizmiga ega)
  //  - Next.js ichki fayllari va statik resurslar
  matcher: [
    "/((?!login|api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
