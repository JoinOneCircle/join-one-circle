import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  compact?: boolean;
  light?: boolean;
  href?: string;
};

export function BrandLogo({ compact = false, light = false, href = "/" }: BrandLogoProps) {
  return (
    <Link className={`brand-logo ${compact ? "brand-logo--compact" : ""} ${light ? "brand-logo--light" : ""}`} href={href} aria-label="Join One Circle home">
      <span className="brand-logo__crop" aria-hidden="true">
        <Image
          src={compact ? (light ? "/logo-icon-white.png" : "/logo-icon.png") : (light ? "/logo-white-horizontal.png" : "/logo-black-horizontal.png")}
          alt=""
          fill
          priority
          sizes={compact ? "48px" : "230px"}
        />
      </span>
    </Link>
  );
}
