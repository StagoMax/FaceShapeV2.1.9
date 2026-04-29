import Link from 'next/link';
import type { LegalDocument } from '@/lib/i18n/legalContent';

export default function LegalDocumentPage({ document }: { document: LegalDocument }) {
  return (
    <main className="policy-page">
      <div className="card policy-card">
        <div className="policy-header">
          <div className="kicker">{document.kicker}</div>
          <h1 className="title">{document.title}</h1>
          {document.effectiveDate ? <p className="policy-meta">{document.effectiveDate}</p> : null}
          {document.lastUpdated ? <p className="policy-meta">{document.lastUpdated}</p> : null}
        </div>
        <div className="policy-content">
          {document.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.blocks.map((block, index) => {
                const key = `${section.title}-${block.type}-${index}`;

                if (block.type === 'h3') {
                  return <h3 key={key}>{block.text}</h3>;
                }

                if (block.type === 'p') {
                  return <p key={key}>{block.text}</p>;
                }

                if (block.type === 'ul') {
                  return (
                    <ul key={key}>
                      {block.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  );
                }

                if (block.type === 'ol') {
                  return (
                    <ol key={key}>
                      {block.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ol>
                  );
                }

                if (block.type === 'contact') {
                  return (
                    <p key={key}>
                      {block.label}:{' '}
                      {block.href ? (
                        <a className="policy-link" href={block.href}>
                          {block.value}
                        </a>
                      ) : (
                        block.value
                      )}
                    </p>
                  );
                }

                if (block.type === 'links') {
                  return (
                    <div key={key} className="policy-links">
                      {block.items.map((item) => (
                        <Link key={item.href} href={item.href}>
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  );
                }

                return (
                  <div key={key}>
                    {block.lines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
