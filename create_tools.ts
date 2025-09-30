import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import * as yaml from 'js-yaml';

interface VariableConfig {
  required?: boolean;
  default?: string;
}

interface RequestTemplate {
  URL: string;
  METHOD: string;
  HEADERS?: (string | Record<string, string>)[];
  BODY?: string;
}

interface YamlConfig {
  name: string;
  variables: Record<string, VariableConfig>;
  request_template: RequestTemplate;
}

export function parseYamlConfig(content: string): YamlConfig {
  try {
    const parsed = yaml.load(content) as any;
    
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid YAML content');
    }
    
    if (!parsed.request_template) {
      throw new Error('Missing request_template in YAML config');
    }
    
    
    const config: YamlConfig = {
      name: parsed.name || '',
      variables: parsed.variables || {},
      request_template: {
        URL: parsed.request_template.URL || '',
        METHOD: parsed.request_template.METHOD || 'GET',
        HEADERS: parsed.request_template.HEADERS || [],
        BODY: parsed.request_template.BODY || ''
      }
    };
    
    return config;
  } catch (error) {
    console.error('Error parsing YAML:', error);
    throw new Error(`Failed to parse YAML config: ${error}`);
  }
}

export async function createToolFromConfig(config: YamlConfig, server: any) {
  const toolName = config.name.replace(/[^a-zA-Z0-9_]/g, '_');
  const parameters: Record<string, any> = {};
  
  // Create Zod schema for all variables
  Object.entries(config.variables).forEach(([variableName, varConfig]) => {
    const isRequired = varConfig.required !== false; // Default to required if not specified
    
    if (isRequired) {
      parameters[variableName] = z.string().describe(`The ${variableName} parameter`);
    } else {
      parameters[variableName] = z.string().optional().describe(`The ${variableName} parameter (optional)`);
    }
  });
  
  
  server.tool(
    toolName,
    config.name,
    parameters,
    async (args: Record<string, string>) => {
      console.error(`${toolName} tool called`, args);
      
      try {
        // Replace variables in the request template
        let url = config.request_template.URL;
        let body = config.request_template.BODY || '';
        
        Object.entries(config.variables).forEach(([varName, varConfig]) => {
          let value = args[varName];
          
          // If no value provided, use default or empty string
          if (value === undefined || value === null) {
            value = varConfig.default || '';
          }
          
          // Replace variables in URL and body
          url = url.replace(new RegExp(`{${varName}}`, 'g'), value);
          body = body.replace(new RegExp(`{${varName}}`, 'g'), value);
        });
        
        // Clean up the body - remove surrounding quotes if present
        if (body.startsWith("'") && body.endsWith("'")) {
          body = body.slice(1, -1);
        } else if (body.startsWith('"') && body.endsWith('"')) {
          body = body.slice(1, -1);
        }
        
        
        // Build headers object
        const headers: Record<string, string> = {};
        if (config.request_template.HEADERS) {
          config.request_template.HEADERS.forEach(header => {
            if (typeof header === 'string') {
              const [key, value] = header.split(':').map(s => s.trim());
              if (key && value) {
                headers[key] = value;
              }
            } else if (typeof header === 'object' && header !== null) {
              // Handle object format headers
              Object.entries(header).forEach(([key, value]) => {
                if (typeof value === 'string') {
                  headers[key] = value;
                }
              });
            }
          });
        }
        
        // Build fetch options
        const options: RequestInit = {
          method: config.request_template.METHOD,
          headers: headers
        };
        
        // Add body if present and method supports it
        if (body && ['POST', 'PUT', 'PATCH'].includes(config.request_template.METHOD)) {
          options.body = body;
        }
        
        // Execute the fetch request
        const response = await fetch(url, options);
        
        let responseText = '';
        try {
          responseText = await response.text();
        } catch (e) {
          responseText = `Response status: ${response.status} ${response.statusText}`;
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Request executed successfully:\n\nStatus: ${response.status} ${response.statusText}\n\nResponse:\n${responseText}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error executing request: ${error.message}`,
            },
          ],
        };
      }
    }
  );
}

export async function loadToolsFromConfigs(server: any) {
  try {
    const endpointsDir = join(process.cwd(), 'config', 'endpoints');
    const yamlFiles = readdirSync(endpointsDir).filter(file => file.endsWith('.yaml'));
    
    for (const yamlFile of yamlFiles) {
      const filePath = join(endpointsDir, yamlFile);
      const content = readFileSync(filePath, 'utf-8');
      const config = parseYamlConfig(content);
      await createToolFromConfig(config, server);
      console.error(`Loaded tool: ${config.name}`);
    }
  } catch (error) {
    console.error('Error loading tools from configs:', error);
  }
}
