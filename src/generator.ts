import { Kind, DocumentNode, InterfaceTypeDefinitionNode, FieldDefinitionNode, ObjectTypeDefinitionNode, TypeNode, EnumTypeDefinitionNode, InputObjectTypeDefinitionNode, InputValueDefinitionNode } from 'graphql';

/**
 * Generate type assuming it is not nullable.
 */
function generateDefType(node: TypeNode): string {
    if (node.kind === Kind.NAMED_TYPE) {
        switch (node.name.value) {
            case 'ID': return 'string';
            case 'String': return 'string';
            case 'Float': return 'number';
            case 'Int': return 'number';
            case 'Boolean': return 'boolean';
            default: return node.name.value;
        }
    }

    if (node.kind === Kind.LIST_TYPE) {
        return 'ArrayOrValue<' + generateType(node.type) + '>';
    }

    if (node.kind === Kind.NON_NULL_TYPE) {
        return generateDefType(node.type);
    }
}

/**
 * Checks if a type is not nullable (!-operator) and wraps it into
 * a Maybe<T> if it is.
 */
function generateType(node: TypeNode): string {
    if (node.kind === Kind.NON_NULL_TYPE) {
        return generateDefType(node.type);
    }

    return `Maybe<${generateDefType(node)}>`;
}

/**
 * Generates a resolver for a single field.
 */
function generateField(node: FieldDefinitionNode | InputValueDefinitionNode) {
    const fieldType = generateType(node.type);
    const fieldOptional = node.type.kind === Kind.NON_NULL_TYPE ? '' : '?';

    // Input fields must be explicitly defined (i.e. they cannot return a promise)
    if (node.kind === Kind.INPUT_VALUE_DEFINITION) {
        return `${node.name.value}${fieldOptional}: ${fieldType};`;
    }

    // If no arguments are present literal values may be present in addition to a function.
    if (node.arguments.length === 0)
        return `${node.name.value}${fieldOptional}: Field<${fieldType}>;`;

    // Otherwise a function must be set that either returns a promise or a value.
    const args = [];
    for(const argument of node.arguments) {
        const optional = argument.type.kind === Kind.NON_NULL_TYPE ? '' : '?';
        args.push(argument.name.value + optional + ': ' + generateDefType(argument.type));
    }

    return `${node.name.value}${fieldOptional}: Resolve<${fieldType}, {${args.join(', ')}}>;`;
}

/**
 * Generates type declaration for an interface.
 */
function generateInterfaceType(node: InterfaceTypeDefinitionNode | ObjectTypeDefinitionNode | InputObjectTypeDefinitionNode) {
    let data = `export interface ${node.name.value} {\n`;

    for(const field of node.fields) {
        data += '\t' + generateField(field) + '\n';
    }

    data += '}\n'

    return data;
}

function generateEnumType(node: EnumTypeDefinitionNode) {
    const values = node.values.map((n) => `'${n.name.value}'`);
    return `export type ${node.name.value} = ${values.join(' | ')};\n`;
}

export function generateResolverTypes(context: string, header: string, document: DocumentNode) {
    let result = header + '\n';
    result += `export type ArrayOrValue<TValue> = Array<TValue> | TValue;\n`;
    result += `export type Resolve<TResult, TArgs = {}> = (args?: TArgs, context?: ${context}) => TResult | Promise<TResult>;\n`;
    result += `export type Field<TResult> = TResult | Promise<TResult> | Resolve<TResult>;\n`;
    result += 'export type Maybe<TValue> = TValue | undefined;\n';

    for(const definition of document.definitions) {
        if (definition.kind === Kind.INTERFACE_TYPE_DEFINITION) {
            result += generateInterfaceType(definition) + "\n";
        } else if(definition.kind === Kind.OBJECT_TYPE_DEFINITION) {
            result += generateInterfaceType(definition) + "\n";
        } else if (definition.kind === Kind.ENUM_TYPE_DEFINITION) {
            result += generateEnumType(definition) + "\n";
        } else if (definition.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION) {
            result += generateInterfaceType(definition) + "\n";
        } else {
            throw Error(definition.kind);
        }
    }

    return result;
}