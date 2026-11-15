import site from '../../data/site.json';

/** Author and project links, from data/site.json. */
export function Credits() {
  const { author, repository } = site;
  return (
    <span className="credits">
      Made by {author.name}
      {' · '}
      <a href={repository} target="_blank" rel="noopener noreferrer">
        Source on GitHub
      </a>
      {author.github && (
        <>
          {' · '}
          <a href={author.github} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </>
      )}
      {author.linkedin && (
        <>
          {' · '}
          <a href={author.linkedin} target="_blank" rel="noopener noreferrer">
            LinkedIn
          </a>
        </>
      )}
    </span>
  );
}
