import { describe, expect, it } from "vitest";
import { extractTitle, htmlToText, truncateText } from "../../extensions/web-tools/lib/html-text.js";

describe("htmlToText", () => {
  it("drops scripts, styles and nav, keeps readable text", () => {
    const html = `<html><head><style>p{color:red}</style><script>var x = 1;</script></head>
      <body><nav>Menu Home</nav><h1>Title</h1><p>First &amp; second&nbsp;line.</p><p>It&#39;s &quot;ok&quot;.</p></body></html>`;
    const text = htmlToText(html);
    expect(text).not.toContain("var x");
    expect(text).not.toContain("color:red");
    expect(text).not.toContain("Menu Home");
    expect(text).toContain("First & second line.");
    expect(text).toContain(`It's "ok".`);
  });

  it("renders MathML once, using its alttext", () => {
    const html = `<p>window (<math alttext="T=18"><semantics><mrow><mi>T</mi><mo>=</mo><mn>18</mn></mrow>` +
      `<annotation encoding="application/x-tex">T=18</annotation></semantics></math>) ahead</p>`;
    expect(htmlToText(html)).toBe("window ( T=18 ) ahead");
  });

  it("drops MathML annotations when there is no alttext", () => {
    const html = `<p><math><mi>x</mi><annotation encoding="application/x-tex">x</annotation></math> wins</p>`;
    expect(htmlToText(html)).toBe("x wins");
  });

  it("puts block elements on separate lines", () => {
    expect(htmlToText("<p>a</p><p>b</p><br>c")).toBe("a\nb\nc");
  });
});

describe("extractTitle", () => {
  it("reads the title tag", () => {
    expect(extractTitle("<head><title> Hello &amp; bye </title></head>")).toBe("Hello & bye");
    expect(extractTitle("<p>no title</p>")).toBe("");
  });
});

describe("truncateText", () => {
  it("keeps short text unchanged", () => {
    expect(truncateText("abc", 10)).toEqual({ text: "abc", truncated: false });
  });

  it("cuts long text and reports truncation", () => {
    expect(truncateText("abcdef", 4)).toEqual({ text: "abcd", truncated: true });
  });
});
