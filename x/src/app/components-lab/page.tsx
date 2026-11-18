import React from "react";
import { SiteHeader } from "@/components/shared/SiteHeader";
import { DeveloperFooter } from "@/components/shared/DeveloperFooter";
import { ComponentsLabClient } from "@/components/lab/ComponentsLabClient";

export default function ComponentsLabPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#08070d] text-zinc-100">
      <SiteHeader activePath="/components-lab" />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="text-xs font-semibold tracking-wider text-amber-400 uppercase">
            Component Templates & 3D Engine
          </p>
          <h1 className="mt-2.5 text-3xl font-extrabold sm:text-5xl">
            مكتبة تصميمات العناصر والمؤثرات
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
            75 عنصراً داخلياً مستقلاً (10 واجهات Hero، 12 خلفية، 8 خطوط، 10 أزرار، 9 معارض، 16
            قسماً، و10 مؤثرات 3D وحركية) قابلة للدمج والتخصيص.
          </p>
        </div>

        <ComponentsLabClient />
      </main>

      <DeveloperFooter mode="dark" accentColor="#f59e0b" />
    </div>
  );
}
