import { beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Point the storage adapter at a throwaway fs dir BEFORE any store call.
beforeAll(() => {
  process.env.EDGEPRESS_STORAGE = "fs";
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "ep-courses-"));
});

import { createCourse, deleteCourse, getCourse, getPublishedCourses, updateCourse } from "@/lib/courses-store";

describe("courses store (fs adapter)", () => {
  it("creates a draft with a slug from the title", async () => {
    const c = await createCourse({ title: { en: "Intro to EdgePress" } });
    expect("error" in c).toBe(false);
    if ("error" in c) return;
    expect(c.slug).toBe("intro-to-edgepress");
    expect(c.status).toBe("draft");
  });

  it("rejects an empty title, dedupes slugs", async () => {
    expect(await createCourse({ title: { en: " " } })).toHaveProperty("error");
    const dup = await createCourse({ title: { en: "Intro to EdgePress" } });
    if ("error" in dup) throw new Error("create failed");
    expect(dup.slug).not.toBe("intro-to-edgepress");
  });

  it("drafts stay off the public list until published", async () => {
    expect(await getPublishedCourses()).toEqual([]);
    const c = await getCourse("intro-to-edgepress");
    await updateCourse(c!.id, { status: "published" });
    expect((await getPublishedCourses()).map((x) => x.slug)).toContain("intro-to-edgepress");
  });

  it("normalizes lessons: slugs derived + deduped, order kept", async () => {
    const c = await getCourse("intro-to-edgepress");
    const up = await updateCourse(c!.id, {
      lessons: [
        { title: { en: "Getting Started" }, body: { en: "<p>hi</p>" }, videoUrl: "https://youtu.be/abc123xyz" },
        { title: { en: "Getting Started" }, body: { en: "<p>again</p>" } },
      ] as never,
    });
    expect(up?.lessons.length).toBe(2);
    expect(up?.lessons[0].slug).toBe("getting-started");
    expect(up?.lessons[1].slug).not.toBe(up?.lessons[0].slug);
    expect(up?.lessons[0].videoUrl).toContain("youtu");
  });

  it("slug collisions on update are ignored (keeps the old slug)", async () => {
    const other = await createCourse({ title: { en: "Second Course" } });
    if ("error" in other) throw new Error("create failed");
    const up = await updateCourse(other.id, { slug: "intro-to-edgepress" });
    expect(up?.slug).toBe("second-course");
  });

  it("delete removes the course", async () => {
    const c = await getCourse("second-course");
    expect(await deleteCourse(c!.id)).toBe(true);
    expect(await getCourse("second-course")).toBeNull();
  });
});
