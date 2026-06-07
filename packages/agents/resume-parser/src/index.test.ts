import { describe, expect, it } from 'vitest';
import { getEvolutionHistory, parseResume } from './index';

const SAMPLE_RESUME = `
John Smith
San Francisco, CA
john.smith@email.com | (415) 555-1234 | linkedin.com/in/johnsmith

Summary
Experienced software engineer with 8+ years building scalable web applications.
Passionate about clean code, testing, and developer experience.

Experience
Senior Software Engineer at Acme Corp
January 2021 - Present
- Led migration from monolith to microservices, reducing deploy time by 80%
- Built real-time data pipeline processing 1M events/day
- Mentored 4 junior engineers

Software Engineer | StartupXYZ
June 2018 - December 2020
- Developed React frontend serving 50K daily active users
- Implemented CI/CD pipeline with GitHub Actions
- Reduced page load time from 4s to 1.2s

Education
B.S. Computer Science - Stanford University
2014 - 2018

Skills
JavaScript, TypeScript, React, Node.js, Python, PostgreSQL, Redis, AWS, Docker, Kubernetes, GraphQL, REST APIs

Certifications
AWS Solutions Architect Associate
Google Cloud Professional Cloud Architect
`;

describe('parseResume', () => {
  const result = parseResume(SAMPLE_RESUME);

  it('extracts name', () => {
    expect(result.name).toBe('John Smith');
  });

  it('extracts email', () => {
    expect(result.email).toBe('john.smith@email.com');
  });

  it('extracts phone', () => {
    expect(result.phone).toContain('4155551234');
  });

  it('extracts linkedin', () => {
    expect(result.linkedin).toBe('linkedin.com/in/johnsmith');
  });

  it('extracts location', () => {
    expect(result.location).toBe('San Francisco, CA');
  });

  it('extracts summary', () => {
    expect(result.summary).toContain('Experienced software engineer');
  });

  it('extracts skills', () => {
    expect(result.skills).toContain('JavaScript');
    expect(result.skills).toContain('React');
    expect(result.skills).toContain('Python');
    expect(result.skills.length).toBeGreaterThan(5);
  });

  it('extracts experience entries', () => {
    expect(result.experience.length).toBeGreaterThanOrEqual(1);
    expect(result.experience[0].title).toContain('Senior Software Engineer');
  });

  it('extracts education', () => {
    expect(result.education.length).toBeGreaterThanOrEqual(1);
    expect(result.education[0].degree).toContain('Computer Science');
  });

  it('extracts certifications', () => {
    expect(result.certifications.length).toBe(2);
    expect(result.certifications[0]).toContain('AWS');
  });

  it('handles empty input', () => {
    const empty = parseResume('');
    expect(empty.name).toBeNull();
    expect(empty.skills).toEqual([]);
  });

  it('handles minimal input', () => {
    const minimal = parseResume('Jane Doe\njane@example.com');
    expect(minimal.name).toBe('Jane Doe');
    expect(minimal.email).toBe('jane@example.com');
  });
});

describe('getEvolutionHistory', () => {
  it('returns 7 versions', () => {
    const history = getEvolutionHistory();
    expect(history).toHaveLength(7);
  });

  it('scores improve monotonically', () => {
    const history = getEvolutionHistory();
    for (let i = 1; i < history.length; i++) {
      expect(history[i].score).toBeGreaterThan(history[i - 1].score);
    }
  });

  it('examples grow monotonically', () => {
    const history = getEvolutionHistory();
    for (let i = 1; i < history.length; i++) {
      expect(history[i].examples).toBeGreaterThan(history[i - 1].examples);
    }
  });
});
