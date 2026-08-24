const SKILL_ALIASES: Record<string, string[]> = {
  react: ["react", "react.js", "reactjs"],
  "node.js": ["node", "node.js", "nodejs"],
  typescript: ["typescript", "ts"],
  javascript: ["javascript", "js"],
  python: ["python", "py"],
  java: ["java"],
  go: ["golang"],
  aws: ["aws"],
  postgres: ["postgres", "postgresql", "psql"],
  mysql: ["mysql"],
  mongodb: ["mongodb", "mongo"],
  redis: ["redis"],
  dynamodb: ["dynamodb", "dynamo"],
  docker: ["docker"],
  kubernetes: ["kubernetes", "k8s"],
  terraform: ["terraform", "tf"],
  git: ["git"],
  graphql: ["graphql"],
  "rest-api": ["restful", "rest api", "restful api", "restful apis"],
  ".net": [".net", "dotnet", "dot.net"],
  c: ["c"],
  "c#": ["c#", "csharp", "c-sharp"],
  "c++": ["c++", "cplusplus", "c/c++"],
  minikube: ["minikube"],
  fastapi: ["fastapi", "fast api", "fast-api"],
  express: ["express", "express.js", "expressjs"],
  "next.js": ["next.js", "nextjs"],
  html: ["html", "html5"],
  css: ["css", "css3"],
  linux: ["linux"],
  sql: ["sql"],
  lambda: ["lambda"],
  s3: ["s3"],
  gcp: ["gcp", "gcloud", "google cloud"],
  azure: ["azure"],
  spring: ["spring", "springboot", "spring-boot", "spring boot"],
  angular: ["angular", "angularjs"],
  flask: ["flask"],
  junit: ["junit"],
  pyspark: ["pyspark", "spark"],
  rabbitmq: ["rabbitmq", "rabbit"],
  kafka: ["kafka"],
};

const aliasToCanonical = new Map<string, string>();

for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
  for (const alias of aliases) {
    aliasToCanonical.set(alias, canonical);
  }
}

export function normalizeToken(raw: string): string | null {
  const token = raw.trim().toLowerCase();
  if (!token) {
    return null;
  }
  return aliasToCanonical.get(token) ?? null;
}
