import site from '../../data/site.json';
import { useI18n } from '../i18n';

/** Author and project links, from data/site.json. */
export function Credits() {
  const { author, repository } = site;
  const { t } = useI18n();
  return (
    <span className="credits">
      {t('credits.madeBy', { name: author.name })}
      {' · '}
      <a href={repository} target="_blank" rel="noopener noreferrer">
        {t('credits.source')}
      </a>
      {author.github && (
        <>
          {' · '}
          <a href={author.github} target="_blank" rel="noopener noreferrer">
            {t('credits.github')}
          </a>
        </>
      )}
      {author.linkedin && (
        <>
          {' · '}
          <a href={author.linkedin} target="_blank" rel="noopener noreferrer">
            {t('credits.linkedin')}
          </a>
        </>
      )}
      {author.email && (
        <>
          {' · '}
          <a href={`mailto:${author.email}`}>{author.email}</a>
        </>
      )}
      {author.support && (
        <>
          {' · '}
          <a href={author.support} target="_blank" rel="noopener noreferrer">
            {t('credits.support')}
          </a>
        </>
      )}
    </span>
  );
}
