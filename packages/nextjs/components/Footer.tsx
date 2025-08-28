import React, { useMemo } from "react";
import { useTheme } from "next-themes";

/**
 * Site footer
 */
export const Footer = () => {
  const { resolvedTheme } = useTheme();

  const isDarkMode = useMemo(() => {
    return resolvedTheme === "dark";
  }, [resolvedTheme]);

  return (
    <div
      className="min-h-0 py-5 px-1 mb-11 lg:mb-0"
      style={{
        backgroundColor: isDarkMode ? "black" : "white",
      }}
    >
      <div className="w-full">
        <ul className="menu menu-horizontal w-full">
          <div className="flex justify-center items-center gap-2 text-sm w-full">
            <div className="text-center">
              <a href="https://github.com/Arb-Stylus/scaffold-stylus" target="_blank" rel="noreferrer" className="link">
                Fork me
              </a>
            </div>
            <span>·</span>
            <div className="text-center">
              <a href="https://t.me/joinchat/KByvmRe5wkR-8F_zz6AjpA" target="_blank" rel="noreferrer" className="link">
                Support
              </a>
            </div>
          </div>
        </ul>
      </div>
    </div>
  );
};
