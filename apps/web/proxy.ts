import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Rotas públicas de autenticação
const AUTH_ROUTES = ["/login", "/register", "/verify-email"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = !!getSessionCookie(request);
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  // Usuário não autenticado tentando acessar área logada → login
  if (!hasSession && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Usuário autenticado tentando acessar telas de auth → dashboard
  if (hasSession && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/overview";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Protege tudo exceto assets estáticos e o próprio /api (proxied à API externa)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
