import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import * as yaml from 'js-yaml';
import { toJavaScript } from 'curlconverter';

interface VariableConfig {
  required?: boolean;
  default?: string;
}

interface YamlConfig {
  name: string;
  variables: Record<string, VariableConfig>;
  curl_command: string;
}

export function parseYamlConfig(content: string): YamlConfig {
  try {
    const parsed = yaml.load(content) as any;
    
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid YAML content');
    }
    
    const config: YamlConfig = {
      name: parsed.name || '',
      variables: parsed.variables || {},
      curl_command: parsed.curl_command || ''
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
        // Replace variables in the curl command
        let curlCommand = config.curl_command;
        Object.entries(config.variables).forEach(([varName, varConfig]) => {
          let value = args[varName];
          
          // If no value provided, use default or empty string
          if (value === undefined || value === null) {
            value = varConfig.default || '';
          }
          
          curlCommand = curlCommand.replace(new RegExp(`{${varName}}`, 'g'), value);
        });
        
        // Convert curl command to JavaScript fetch
        const jsCode = toJavaScript(curlCommand);
        
        // Parse the generated JavaScript to extract fetch parameters
        const urlMatch = jsCode.match(/fetch\(['"`]([^'"`]+)['"`]/);
        const optionsMatch = jsCode.match(/fetch\([^,]+,\s*({[^}]+})/);
        
        if (!urlMatch) {
          throw new Error('Could not extract URL from curl command');
        }
        
        const url = urlMatch[1];
        let options: RequestInit = {};
        
        if (optionsMatch) {
            // Parse the options object from the generated JavaScript
          const optionsStr = optionsMatch[1].replace(/'/g, '"');
          options = JSON.parse(optionsStr);
        } else {
          throw new Error('Could not extract options from curl command');
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
