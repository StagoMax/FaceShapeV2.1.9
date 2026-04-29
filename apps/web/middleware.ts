import { NextRequest, NextResponse } from 'next/server';

const COUNTRY_HEADER_KEY = 'x-miri-country';
const COUNTRY_COOKIE_KEY = 'miri-country';

const isExemptPath = (pathname: string) => pathname.startsWith('/_next/');

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isExemptPath(pathname)) {
    return NextResponse.next();
  }

  const countryCode = (request.headers.get('x-vercel-ip-country') ?? '').trim().toUpperCase();
  const requestHeaders = new Headers(request.headers);

  if (countryCode) {
    requestHeaders.set(COUNTRY_HEADER_KEY, countryCode);
  } else {
    requestHeaders.delete(COUNTRY_HEADER_KEY);
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (countryCode) {
    response.cookies.set(COUNTRY_COOKIE_KEY, countryCode, {
      path: '/',
      sameSite: 'lax',
    });
  } else {
    response.cookies.set(COUNTRY_COOKIE_KEY, '', {
      path: '/',
      maxAge: 0,
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|favicon.ico|icon.png|apple-icon.png|robots.txt|sitemap.xml).*)'],
};
