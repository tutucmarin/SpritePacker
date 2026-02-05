import type { ReactNode } from "react";
import "../styles/index.css";

export const metadata = {
  title: "SpritePacker — Free Sprite Sheet Slicer & Image Splitter",
  description:
    "Split images and sprite sheets entirely in your browser. Auto-detect sprites, grid export, naming and ordering. No uploads.",
  keywords:
    "split image online,image splitter,image slicer,sprite sheet slicer,sprite splitter,split png online,split jpg online,split webp online,webp splitter,auto-detect sprites",
  openGraph: {
    title: "SpritePacker — Free Sprite Sheet Slicer & Image Splitter",
    description:
      "Split images and sprite sheets entirely in your browser. Auto-detect sprites, export PNG/JPG/WebP, privacy-first.",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "SpritePacker — Free Sprite Sheet Slicer & Image Splitter",
    description:
      "Split images and sprite sheets entirely in your browser. Auto-detect sprites, export PNG/JPG/WebP, privacy-first."
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
