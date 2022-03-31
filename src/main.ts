import { Command } from 'commander';
import { parse } from 'graphql';
import fs from 'fs';
import { generateResolverTypes } from './generator';
import prettier from 'prettier';

const program = new Command();

program
    .name('gql-codegen')
    .argument('<input-file>')
    .argument('[output-file]')
    .action((inputFilename, outputFilename) => {
        const schema = fs.readFileSync(inputFilename);
        const document = parse(schema.toString('utf-8'));

        const context = 'Request';
        const header = "import { Request } from 'express';\n";

        const resolverTypes = generateResolverTypes(context, header, document);

        const prettyCode = prettier.format(resolverTypes, {
            parser: 'typescript',
            singleQuote: true,
          });


        fs.writeFileSync(outputFilename, prettyCode);

    });

program.parse();
