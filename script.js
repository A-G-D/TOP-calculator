const OP_ADD = '+';
const OP_SUB = '-';
const OP_MUL = '*';
const OP_DIV = '/';
const OP_POW = '^';
const OP_EXP = 'E';

const EXPRGROUP_IDENTITY = '1';

const EXPRGROUP_BEGIN = '(';
const EXPRGROUP_END = ')';


function isNull(o) {
    return o === null || o === undefined;
}

function isNumber(s) {
    return Number.isFinite(parseInt(s, 10));
}

function arrToStr(a, quoteStrings = true) {
    if (Array.isArray(a)) {
        let s = '[';
        for (let i = 0; i < a.length; ++i) {
            s += arrToStr(a[i]);
            if (i + 1 < a.length)
                s += ', ';
        }
        return s + ']';
    }
    return ((typeof a) === 'string' && quoteStrings)? `'${a}'` : a.toString();
}


class ExpressionTree {
    #left;
    #right;
    #data;

    static #operate(op, left, right) {
        switch (op) {
            case OP_ADD:
                if (isNull(left)) left = 0;
                return left + right;
            
            case OP_SUB:
                if (isNull(left)) left = 0;
                return left - right;

            case OP_MUL:
                return left*right;

            case OP_DIV:
                return left/right;

            case OP_POW:
                return left**right;

            case OP_EXP:
                return left*Math.pow(10, right);
        }

        throw new Error('INVALID OPERATION ARGUMENT');
    }

    constructor(data, left = undefined, right = undefined) {
        this.#data = data;
        this.#left = left;
        this.#right = right;
    }

    get left() {
        return this.#left;
    }
    get right() {
        return this.#right;
    }
    get data() {
        return this.#data;
    }

    evaluate() {
        const operator = this.data;

        // console.log(`preeval: ${parseInt(operator, 10)} ${this.left} ${this.right}`);
        if (isNumber(operator))
            return parseInt(operator, 10);

        const leftOperand = isNull(this.left)? undefined : this.left.evaluate();
        const rightOperand = isNull(this.right)? undefined : this.right.evaluate();

        // console.log(`eval: ${operator} ${leftOperand} ${rightOperand}`);
        return ExpressionTree.#operate(operator, leftOperand, rightOperand);
    }

    traversePreorder(onTraverse) {
        onTraverse(this.data);
        if (!isNull(this.left)) this.left.traversePreorder(onTraverse);
        if (!isNull(this.right)) this.right.traversePreorder(onTraverse);
    }

    traverseInorder(onTraverse) {
        if (!isNull(this.left)) this.left.traverseInorder(onTraverse);
        onTraverse(this.data);
        if (!isNull(this.right)) this.right.traverseInorder(onTraverse);
    }

    traversePostorder(onTraverse) {
        if (!isNull(this.left)) this.left.traversePostorder(onTraverse);
        if (!isNull(this.right)) this.right.traversePostorder(onTraverse);
        onTraverse(this.data);
    }

    toString(indent = '') {
        let s = `${indent}${this.data}`;

        if (isNull(this.left) && isNull(this.right)) return s;

        let newIndent = indent + '\t';
        s += '\n';
        s += indent + '{\n';
        if (isNull(this.left))
            s += newIndent + 'NULL,\n';
        else
            s += this.left.toString(newIndent) + ',\n';
        if (isNull(this.right))
            s += newIndent + 'NULL\n';
        else
            s += this.right.toString(newIndent) + '\n';
        s += indent + '}';

        return s;
    }
}


function parseExpressionGroups(expressionString) {
    let groups = [];
    let segment = '';
    let level = 0;

    for (let i = 0; i < expressionString.length; ++i) {
        const c = expressionString[i];

        switch (c) {
            case EXPRGROUP_BEGIN:
                if (level === 0) {
                    if (segment.length > 0) {
                        if (isNumber(segment[segment.length - 1]))
                            segment += OP_MUL;
                        groups.push(segment);
                        segment = '';
                    }
                }
                ++level;
                break;

            case EXPRGROUP_END:
                --level;
                if (level === 0) {
                    if (segment.length === 0)
                        segment = EXPRGROUP_IDENTITY;
                    groups.push(parseExpressionGroups(segment));
                    segment = '';
                    if ((i + 1 < expressionString.length) &&
                            isNumber(expressionString[i + 1])) {
                        segment = OP_MUL;
                    }
                }
                break;

            default:
                segment += c;
        }
    }

    if (segment.length > 0)
        groups.push(segment);

    return groups;
}

function parseExpressionNodes(expressionTerms, allowAsUnary, ...operators) {
    let nodes = [];

    for (let i = 0; i < expressionTerms.length; ++i) {
        const term = expressionTerms[i];
        let segment = '';

        if ((typeof term) === 'string') {
            for (let j = 0; j < term.length; ++j) {
                const c = term[j];

                if (operators.some(value => value === c)) {
                    if (segment.length > 0) {
                        nodes.push(segment);
                        nodes.push(c);
                        segment = '';
                    } else if (allowAsUnary) {
                        segment += c;
                    }

                } else {
                    segment += c;
                }
            }

            if (segment.length > 0)
                nodes.push(segment);
        } else {
            nodes.push(parseExpressionNodes(term, allowAsUnary, ...operators));
        }
    }

    return nodes;
}


function generateExpressionTree(exprNodes) {
    if (!Array.isArray(exprNodes))
        return new ExpressionTree(exprNodes);

    const n = exprNodes.length;

    if (n == 1) {
        return generateExpressionTree(exprNodes[0]);

    } else if (n == 2) {
        if ((typeof exprNodes[0]) === 'string') {
            return new ExpressionTree(
                exprNodes[0],
                generateExpressionTree(exprNodes[1])
            );
        }
        return new ExpressionTree(
            OP_MUL,
            generateExpressionTree(exprNodes[0]),
            generateExpressionTree(exprNodes[1])
        );

    } else if (n > 2) {
        if ((typeof exprNodes[1]) === 'string') {
            return new ExpressionTree(
                exprNodes[1],
                generateExpressionTree(exprNodes[0]),
                generateExpressionTree(exprNodes.slice(2))
            );
        }
        return new ExpressionTree(
            OP_MUL,
            generateExpressionTree(exprNodes[0]),
            generateExpressionTree(exprNodes.slice(1))
        );
    }

    throw new Error('UNKNOWN ERROR'); // This shouldn't happen
}


// Will not parse ill-formed expressions
function parseExpression(expressionString) {
    // "1 + 2 - 3*4 + 5*(6 + 7)/8^9";
    // "1 + (2 - 3*4 + 5*(6 + 7)/8^9)";
    // "1 + (2 + (- 3*4 + 5*(6 + 7)/8^9))";
    // "1 + (2 + ((-3)*4 + 5*(6 + 7)/8^9))";
    // "1 + (2 + (((-3)*4) + (5*(6 + 7))/8^9))";
    // "1 + (2 + (((-3)*4) + (5*(6 + 7))/(8^9)))";
    // "1 + (2 + (((-3)*4) + ((5*(6 + 7))/(8^9))))";
    expressionString = expressionString.replace(/\s+/g, '');

    let exprGroups = parseExpressionGroups(expressionString);
    console.log('groups: ', arrToStr(exprGroups));
    let exprTerms = parseExpressionNodes(exprGroups, true, OP_ADD, OP_SUB);
    console.log('terms: ', arrToStr(exprTerms));
    let exprNodes = parseExpressionNodes(exprTerms, false, OP_MUL, OP_DIV);
    console.log('nodes:', arrToStr(exprNodes));
    exprNodes = parseExpressionNodes(exprNodes, false, OP_POW);
    console.log('nodes:', arrToStr(exprNodes));
    exprNodes = parseExpressionNodes(exprNodes, false, OP_EXP);
    console.log('nodes:', arrToStr(exprNodes));

    return generateExpressionTree(exprNodes);
}


function evaluateExpression(expression) {
    let result;
    const expressionTree = parseExpression(expression);
    console.log('tree: ', expressionTree.toString());
    result = expressionTree.evaluate();
    return result
}


console.log('TEST 1:');
let result = evaluateExpression("-2 + (-5*6) - (4^2*3)");
console.log(result + '\n\n');

console.log('TEST 2:');
result = evaluateExpression("-2 + 4*3 + 5");
console.log(result);
console.log(result + '\n\n');