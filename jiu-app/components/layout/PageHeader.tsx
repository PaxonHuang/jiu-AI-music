import type { ReactNode } from 'react';

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  right?: ReactNode;
  children?: ReactNode;
};

export function PageHeader({ eyebrow, title, subtitle, right, children }: PageHeaderProps) {
  return (
    <header className="jiu-page-header">
      <div className="jiu-page-header__row">
        <div className="min-w-0">
          <p className="jiu-page-header__eyebrow">{eyebrow}</p>
          <h1 className="jiu-page-header__title">{title}</h1>
          <p className="jiu-page-header__subtitle">{subtitle}</p>
        </div>
        {right ? <div className="jiu-page-header__right">{right}</div> : null}
      </div>
      {children ? <div className="jiu-page-header__children">{children}</div> : null}
    </header>
  );
}
