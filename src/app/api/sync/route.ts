import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check admin
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase());
  if (!adminEmails.includes(session.user.email?.toLowerCase() || "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { type } = await request.json();

    // Import sync functions dynamically to avoid loading them on every request
    const { runSync } = await import("@/lib/sync/orchestrator");

    // Run sync in background (don't await)
    runSync(type).catch((err: Error) => {
      console.error("Sync error:", err);
    });

    return NextResponse.json({
      message: `${type} sync started in background`,
    });
  } catch (error) {
    console.error("Failed to trigger sync:", error);
    return NextResponse.json(
      { error: "Failed to trigger sync" },
      { status: 500 }
    );
  }
}
