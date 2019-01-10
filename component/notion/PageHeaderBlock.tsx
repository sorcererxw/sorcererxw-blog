import * as moment from 'moment';
import * as React from 'react'
import styled from "styled-components";
import {BlockValue} from "../../api/notion";

const Container = styled.div`
  margin:16px 0;
  display: flex;
  flex-direction: column;
`;

const Title = styled.h1`
  font-size: 40px;
  margin: 0 0 4px;
`;

const MetaContainer = styled.div`
  margin: 8px 0;
`;

const PubDate = styled.div`
  font-size: 16px;
  color: rgba(0,0,0,.54);
  line-height: 1.2;
`;

interface IProps {
    value: BlockValue
}

interface IState {
    _: undefined
}

export default class PageHeaderBlock extends React.Component<IProps, IState> {
    constructor(props: any) {
        super(props);
    }

    public render(): React.ReactNode {
        const properties = this.props.value.properties;
        if (properties === undefined) {
            return null;
        }
        const pubData = moment(this.props.value.created_time).format("YYYY-MM-DD");
        return <Container>
            <Title>{properties.title}</Title>
            <MetaContainer>
                <PubDate>发布于 {pubData}</PubDate>
            </MetaContainer>
        </Container>
    }
}

