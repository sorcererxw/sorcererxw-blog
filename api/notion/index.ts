const fetch = require("node-fetch");
const BASE_URL = "https://www.notion.so/api/v3";

function post<T>(url: string, data: object): Promise<T> {
    return fetch(`${BASE_URL}${url}`,
        {
            body: JSON.stringify(data),
            headers: {'content-type': 'application/json'},
            method: 'POST',
        }
    ).then(res => res.json())
}

export interface BlockFormat {
    page_cover: string,
    page_cover_position: number,
    block_aspect_ratio: number
    block_full_width: boolean
    block_page_width: boolean
    block_preserve_scale: boolean
    block_width: number,
    block_height: number,
    display_source: string,
    column_ratio: number
}

export interface BlockProperties {
    caption: any[],
    language: string[],
    title: any[],
    source: string[]
}

export interface BlockValue {
    id: string,
    content: string[]
    version: number,
    type: string,
    format?: BlockFormat
    properties?: BlockProperties,
    created_time: number,
    last_edited_time: number,
    parent_id: string,
    parent_table: string,
    alive: boolean,
    query: object
}

export interface RecordValue {
    role: string,
    value: BlockValue
}

export interface RecordValues {
    results: RecordValue[]
}

export interface RecordMap {
    block: {
        [blockId: string]: RecordValue
    },
    collection: {
        [blockId: string]: RecordValue
    },
    collection_view: {
        [blockId: string]: RecordValue
    }
}

export interface PageChunk {
    cursor: {
        stack: []
    }
    recordMap: RecordMap
}

export interface Collection {
    recordMap: RecordMap
    result: {
        blockIds: string[],
        total: number,
        type: string
    }
}

export function getRecordValues(
    blockIds: string[]
): Promise<RecordValues> {
    const data = {
        requests: blockIds.map(blockId => {
            return {
                id: getFullBlockId(blockId),
                table: 'block'
            }
        })
    };
    return post<RecordValues>("/getRecordValues", data);
}

export function loadPageChunk(
    pageId: string, count: number, cursor = {stack: []}
): Promise<PageChunk> {
    const data = {
        "cursor": cursor,
        limit: count,
        pageId: getFullBlockId(pageId),
        verticalColumns: false
    };
    return post<PageChunk>("/loadPageChunk", data)
}

export const loadFullPageChunk = async (pageId: string): Promise<RecordValue[]> => {
    const limit = 100;
    const result: RecordValue[] = [];
    let cursor = {stack: []};
    do {
        const pageChunk = (await Promise.resolve(loadPageChunk(pageId, limit, cursor)));
        for (const id in pageChunk.recordMap.block) {
            if (pageChunk.recordMap.block.hasOwnProperty(id)) {
                const item = pageChunk.recordMap.block[id];
                if (item.value.alive) {
                    result.push(item)
                }
            }
        }
        cursor = pageChunk.cursor;
    } while (cursor.stack.length > 0);
    return result
};

export const loadTable = (collectionId: string, collectionViewId: string, query = undefined): Promise<Collection> => {
    const data = {
        collectionId: getFullBlockId(collectionId),
        collectionViewId: getFullBlockId(collectionViewId),
        loader: {
            type: 'table'
        },
        query: query
    };
    return post<Collection>("/queryCollection", data)
};

export const loadTablePageBlocks = async (collectionId: string, collectionViewId: string): Promise<RecordValue[]> => {
    const pageChunkValues = await loadPageChunk(collectionId, 100);
    const tableView = pageChunkValues.recordMap.collection_view[collectionViewId];
    let collection;
    for (let c in pageChunkValues.recordMap.collection) {
        collection = pageChunkValues.recordMap.collection[c];
    }
    console.log(collection);
    const queryResult = await loadTable(
        collection.value.id,
        collectionViewId,
        tableView.value.query);
    console.log(tableView.value.query);
    return queryResult.result.blockIds
        .map(id => queryResult.recordMap.block[id]);
};

interface DicNode {
    record: RecordValue,
    children: Map<String, DicNode>
}

export interface BlockNode {
    value: BlockValue,
    children: BlockNode[]
}

const recordLstToDic = (list: RecordValue[]): Map<string, DicNode> => {
    const findNode = (dic: Map<String, DicNode>, id: String): DicNode => {
        if (dic.has(id)) {
            return dic.get(id);
        }
        for (let [key, entryValue] of dic) {
            key;
            const find = findNode(entryValue.children, id);
            if (find != null) {
                return find
            }
        }
        return null
    };
    const dic: Map<string, DicNode> = new Map();

    list.forEach(item => {
        const itemId = item.value.id;
        const itemParentId = item.value.parent_id;
        const node: DicNode = {
            record: item,
            children: new Map()
        };
        dic.forEach((entryValue, key) => {
            if (entryValue.record.value.parent_id === itemId) {
                node.children.set(key, entryValue);
                dic.delete(key)
            }
        });
        const parent = findNode(dic, itemParentId);
        if (parent != null) {
            parent.children.set(itemId, node)
        } else {
            dic.set(itemId, node)
        }
    });
    return dic
};

export const recordListToTree = (list: RecordValue[]): BlockNode[] => {
    const convertDicNodeToBlockNode = (dicNode: DicNode): BlockNode => {
        const result: BlockNode[] = [];
        dicNode.children.forEach((v) => {
            result.push(convertDicNodeToBlockNode(v))
        });
        return {
            value: dicNode.record.value,
            children: result
        }
    };
    const dicTree = recordLstToDic(list);
    const result: BlockNode[] = [];
    dicTree.forEach((v) => {
        result.push(convertDicNodeToBlockNode(v))
    });
    return result;
};

export function getFullBlockId(blockId: string): string {
    if (blockId.match("^[a-zA-Z0-9]+$")) {
        return blockId.substr(0, 8) + "-"
            + blockId.substr(8, 4) + "-"
            + blockId.substr(12, 4) + "-"
            + blockId.substr(16, 4) + "-"
            + blockId.substr(20, 32)
    } else {
        return blockId;
    }
}

export function getDisplayBlockId(blockId: string): string {
    if (blockId.match("^[a-zA-Z0-9]{8}-([a-zA-Z0-9]{4}-){3}[a-zA-Z0-9]+$")) {
        return blockId.split("-").join("")
    } else {
        return blockId
    }
}