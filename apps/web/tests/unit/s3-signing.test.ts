import { describe, expect, it } from "vitest";
import { signingKey } from "@/lib/media-s3";

describe("AWS SigV4 signing key", () => {
  it("matches AWS's official documented test vector", () => {
    // https://docs.aws.amazon.com/general/latest/gr/signature-v4-examples.html
    const key = signingKey("wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY", "20150830", "us-east-1", "iam");
    expect(key.toString("hex")).toBe("c4afb1cc5771d871763a393e44b703571b55cc28424d1a5e86da6ed3c154a4b9");
  });
});
