import Image from "next/image";

interface BrandMarkProps {
  className?: string;
  size?: number;
}

export function BrandMark({ className, size = 32 }: BrandMarkProps) {
  return (
    <>
      <Image
        alt=""
        className={className ? `${className} dark:hidden` : "dark:hidden"}
        height={size}
        src="/icons/meet37-logo-light.svg"
        width={size}
      />
      <Image
        alt=""
        className={
          className ? `hidden ${className} dark:block` : "hidden dark:block"
        }
        height={size}
        src="/icons/meet37-logo-dark.svg"
        width={size}
      />
    </>
  );
}
