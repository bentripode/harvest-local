import { NextResponse } from "next/server";

import { resolvePhotoUri } from "@/lib/markets/places";

/**
 * Redirect to a Google Places photograph.
 *
 * The browser needs a URL it can put in an `<img>`; the Places media endpoint needs our API key,
 * which must never reach the browser. So this asks Google where the image lives and sends the
 * reader there — the bytes go straight from Google, we neither proxy nor store them, which is what
 * the Places policy requires.
 *
 * `photo` is a photo resource name, which arrives from a query string and is therefore checked
 * against its exact shape in `resolvePhotoUri` before it is put in a URL.
 *
 * `no-store` on our own response too: a cached redirect would outlive the photo reference, which
 * Google rotates, and would be us storing Places content by another name.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const photo = searchParams.get("photo");
  const width = Number(searchParams.get("w") ?? 1200);

  if (!photo) {
    return new NextResponse("Missing photo", { status: 400 });
  }

  const uri = await resolvePhotoUri(photo, Number.isFinite(width) ? width : 1200);
  if (!uri) {
    return new NextResponse("No such photo", { status: 404 });
  }

  return NextResponse.redirect(uri, {
    status: 307,
    headers: { "Cache-Control": "no-store" },
  });
}
