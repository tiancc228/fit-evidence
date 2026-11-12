import { useEffect, useState } from "react";

const ADMIN_KEY = "kepu-verify:admin:v1";
const EVENT = "kepu-admin-change";

export function isAdmin(): boolean {
  try {
    return localStorage.getItem(ADMIN_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAdmin(on: boolean): void {
  try {
    localStorage.setItem(ADMIN_KEY, on ? "1" : "0");
  } catch {
    // 隐私模式下写不进去，退化为当前会话内生效。
  }
  window.dispatchEvent(new Event(EVENT));
}

/** 管理模式的本地开关。审核台与知识库只在这个模式下的导航里出现。 */
export function useAdmin(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(isAdmin);
  useEffect(() => {
    const sync = () => setOn(isAdmin());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return [on, setAdmin];
}
