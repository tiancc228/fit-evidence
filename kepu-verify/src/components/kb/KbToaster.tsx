import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";

/** App 壳可能已挂载 Toaster；避免重复挂载导致提示翻倍。 */
export function KbToaster() {
  const [render, setRender] = useState(false);
  useEffect(() => {
    if (!document.querySelector("[data-sonner-toaster]")) setRender(true);
  }, []);
  return render ? <Toaster position="top-center" richColors /> : null;
}