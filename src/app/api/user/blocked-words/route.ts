import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { blockedWords } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const words = db
      .select()
      .from(blockedWords)
      .where(eq(blockedWords.userId, session.user.id))
      .all();

    return NextResponse.json({
      words: words.map((w) => w.word),
    });
  } catch (error) {
    console.error("Failed to fetch blocked words:", error);
    return NextResponse.json(
      { error: "Failed to fetch blocked words" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { words } = await request.json();

    // Replace all blocked words
    db.delete(blockedWords)
      .where(eq(blockedWords.userId, session.user.id))
      .run();

    if (words && words.length > 0) {
      for (const word of words) {
        db.insert(blockedWords)
          .values({
            userId: session.user.id,
            word: word.toLowerCase().trim(),
          })
          .run();
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update blocked words:", error);
    return NextResponse.json(
      { error: "Failed to update blocked words" },
      { status: 500 }
    );
  }
}
